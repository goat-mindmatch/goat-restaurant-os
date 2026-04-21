/**
 * スタッフRPGシステム
 * /dashboard/rpg
 *
 * EXP計算ロジック:
 *   勤怠1日 = 50 EXP
 *   口コミ獲得1件 = 150 EXP
 *   遅刻なし週 = 100 EXP（全曜日でclock_inが存在する週）
 * レベル = Math.floor(EXP / 1000) + 1
 */
export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import RPGClient from './RPGClient'
import { DEFAULT_REWARDS } from '@/app/api/rpg/rewards/route'
import type { RPGReward } from '@/app/api/rpg/rewards/route'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'

// 称号テーブル
function getTitle(level: number): string {
  if (level <= 3)  return '駆け出しスタッフ'
  if (level <= 7)  return 'ホールの新星'
  if (level <= 12) return '接客の達人'
  if (level <= 18) return '伝説のスタッフ'
  return '人類みなまぜそば之神'
}

export type StaffRPGData = {
  staffId: string
  name: string
  level: number
  exp: number
  title: string
  badges: string[]
  monthlyReviews: number
  workDays: number
  rank: number
  // スキルレベル（各1〜5）
  skillService: number   // 接客: 口コミ数ベース
  skillAttend: number    // 出勤: 出勤率ベース
  skillTeam: number      // チーム: 遅刻ゼロ・バッジ数ベース
}

export type TeamStats = {
  totalReviews: number
  reviewGoal: number
  onTimeCount: number    // 遅刻ゼロのスタッフ数
  totalStaff: number
  teamExp: number
  teamExpGoal: number
}

export default async function RPGPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const today = new Date()
  const jst = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const thisYear  = jst.getFullYear()
  const thisMonth = jst.getMonth() + 1
  const monthStart = `${thisYear}-${String(thisMonth).padStart(2, '0')}-01`
  const monthEnd   = `${thisYear}-${String(thisMonth).padStart(2, '0')}-${String(new Date(thisYear, thisMonth, 0).getDate()).padStart(2, '0')}`
  const todayStr   = jst.toISOString().split('T')[0]

  // 報酬ロードマップ取得
  let rewards: RPGReward[] = DEFAULT_REWARDS
  try {
    const { data: tenantData } = await db
      .from('tenants')
      .select('rpg_rewards')
      .eq('id', TENANT_ID)
      .single()
    if (tenantData?.rpg_rewards && Array.isArray(tenantData.rpg_rewards)) {
      rewards = tenantData.rpg_rewards as RPGReward[]
    }
  } catch { /* use defaults */ }

  // 並列取得
  const [staffRes, rpgRes, attendanceRes, reviewsRes] = await Promise.all([
    db.from('staff')
      .select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
    db.from('staff_rpg')
      .select('staff_id, level, exp, title, badges')
      .eq('tenant_id', TENANT_ID),
    db.from('attendance')
      .select('staff_id, date, clock_in, clock_out')
      .eq('tenant_id', TENANT_ID)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('review_submissions')
      .select('staff_id, created_at')
      .eq('tenant_id', TENANT_ID)
      .eq('verified', true)
      .gte('created_at', `${monthStart}T00:00:00`)
      .lte('created_at', `${monthEnd}T23:59:59`),
  ])

  const staffList: { id: string; name: string }[] = staffRes.data ?? []
  const rpgMap: Record<string, { level: number; exp: number; title: string; badges: string[] }> = {}
  for (const r of (rpgRes.data ?? [])) {
    rpgMap[r.staff_id] = r
  }

  // 勤怠: スタッフ別に集計
  const attendanceMap: Record<string, { dates: string[]; clockIns: string[] }> = {}
  for (const a of (attendanceRes.data ?? [])) {
    if (!attendanceMap[a.staff_id]) {
      attendanceMap[a.staff_id] = { dates: [], clockIns: [] }
    }
    attendanceMap[a.staff_id].dates.push(a.date)
    if (a.clock_in) attendanceMap[a.staff_id].clockIns.push(a.date)
  }

  // 口コミ: スタッフ別に件数集計
  const reviewCountMap: Record<string, number> = {}
  for (const r of (reviewsRes.data ?? [])) {
    if (!reviewCountMap[r.staff_id]) reviewCountMap[r.staff_id] = 0
    reviewCountMap[r.staff_id]++
  }

  // 遅刻ゼロ週の判定: 週単位で全日clock_inが存在するか
  function calcNoPunctualWeeks(staffId: string): number {
    const clockInSet = new Set(attendanceMap[staffId]?.clockIns ?? [])
    const allDates   = attendanceMap[staffId]?.dates ?? []
    if (allDates.length === 0) return 0

    // 週に分割して、その週の出勤日全てにclock_inがあれば1週間カウント
    const weekMap: Record<string, { total: number; onTime: number }> = {}
    for (const dateStr of allDates) {
      const d = new Date(dateStr)
      // 週の月曜日を週キーとする
      const dow  = d.getDay() // 0=日
      const diff = dow === 0 ? -6 : 1 - dow
      const monday = new Date(d)
      monday.setDate(d.getDate() + diff)
      const weekKey = monday.toISOString().split('T')[0]
      if (!weekMap[weekKey]) weekMap[weekKey] = { total: 0, onTime: 0 }
      weekMap[weekKey].total++
      if (clockInSet.has(dateStr)) weekMap[weekKey].onTime++
    }
    let count = 0
    for (const w of Object.values(weekMap)) {
      if (w.total > 0 && w.total === w.onTime) count++
    }
    return count
  }

  // EXP計算
  function calcExp(staffId: string): number {
    const workDays    = (attendanceMap[staffId]?.dates ?? []).length
    const reviewCount = reviewCountMap[staffId] ?? 0
    const noPunctual  = calcNoPunctualWeeks(staffId)
    return workDays * 50 + reviewCount * 150 + noPunctual * 100
  }

  // バッジ判定に必要な口コミ最大件数
  const maxReviews = Math.max(0, ...Object.values(reviewCountMap))

  // 連続出勤判定（7日以上）
  function hasConsecutive7Days(staffId: string): boolean {
    const dates = [...(attendanceMap[staffId]?.dates ?? [])].sort()
    if (dates.length < 7) return false
    let streak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1])
      const curr = new Date(dates[i])
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (diff === 1) {
        streak++
        if (streak >= 7) return true
      } else {
        streak = 1
      }
    }
    return false
  }

  // 遅刻ゼロ（今月の全出勤にclock_inがある）
  function hasZeroLate(staffId: string): boolean {
    const all    = attendanceMap[staffId]?.dates ?? []
    const onTime = attendanceMap[staffId]?.clockIns ?? []
    return all.length > 0 && all.length === onTime.length
  }

  // 全スタッフのRPGデータを組み立て
  const rpgList: Omit<StaffRPGData, 'rank'>[] = staffList.map(s => {
    const existingRpg = rpgMap[s.id]
    const exp = existingRpg ? existingRpg.exp : calcExp(s.id)
    const level = Math.floor(exp / 1000) + 1
    const title = getTitle(level)
    const monthlyReviews = reviewCountMap[s.id] ?? 0
    const workDays = (attendanceMap[s.id]?.dates ?? []).length

    // バッジ判定
    const badges: string[] = []
    if (monthlyReviews > 0 && monthlyReviews === maxReviews) badges.push('👑 月間MVP')
    if (hasConsecutive7Days(s.id)) badges.push('🔥 出勤連続7日')
    if (monthlyReviews >= 10) badges.push('⭐ 口コミ10件超')
    if (hasZeroLate(s.id)) badges.push('⚡ 遅刻ゼロ')

    // スキルレベル計算（1〜5）
    const skillService = Math.min(5, Math.floor(monthlyReviews / 2) + 1)         // 口コミ2件ごと+1
    const skillAttend  = workDays >= 20 ? 5 : workDays >= 15 ? 4 : workDays >= 10 ? 3 : workDays >= 5 ? 2 : 1
    const skillTeam    = Math.min(5, badges.length + 1)

    return { staffId: s.id, name: s.name, level, exp, title, badges, monthlyReviews, workDays, skillService, skillAttend, skillTeam }
  })

  // EXP降順でランク付け
  const ranked: StaffRPGData[] = rpgList
    .sort((a, b) => b.exp - a.exp || b.monthlyReviews - a.monthlyReviews)
    .map((s, i) => ({ ...s, rank: i + 1 }))

  // チームスタッツ
  const totalReviews = Object.values(reviewCountMap).reduce((s, v) => s + v, 0)
  const onTimeCount  = ranked.filter(s => hasZeroLate(s.staffId)).length
  const teamExp      = ranked.reduce((s, r) => s + r.exp, 0)
  const teamStats: TeamStats = {
    totalReviews,
    reviewGoal: Math.max(100, Math.ceil(totalReviews / 10) * 10 + 50),  // 動的目標（今の1.5倍を丸め）
    onTimeCount,
    totalStaff: ranked.length,
    teamExp,
    teamExpGoal: Math.max(10000, Math.ceil(teamExp / 5000) * 5000 + 5000),
  }

  return <RPGClient staffList={ranked} currentMonth={`${thisYear}年${thisMonth}月`} teamStats={teamStats} rewards={rewards} />
}
