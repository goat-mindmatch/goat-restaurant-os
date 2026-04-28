/**
 * スタッフRPGシステム
 * /dashboard/rpg
 *
 * EXP計算ロジック（v2）:
 *   ① Google口コミ獲得1件    = +150 EXP
 *   ② 出退勤（確定シフト基準）
 *        早い / 時間通り      = +50 EXP
 *        遅刻（5分超）        = −30 EXP
 *        シフト未登録日の出勤 = +20 EXP
 *   ③ シフト代打（is_substitute=true）= +200 EXP
 *   ④ 店舗改善承認（store_improvements）= 管理者設定EXP
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
  const [staffRes, rpgRes, attendanceRes, reviewsRes, shiftsRes, improvementsRes] = await Promise.all([
    db.from('staff')
      .select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
    db.from('staff_rpg')
      .select('staff_id, level, exp, title, badges')
      .eq('tenant_id', TENANT_ID),
    db.from('attendance')
      .select('staff_id, date, clock_in, clock_out, is_substitute')
      .eq('tenant_id', TENANT_ID)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    db.from('review_submissions')
      .select('staff_id, created_at')
      .eq('tenant_id', TENANT_ID)
      .eq('verified', true)
      .gte('created_at', `${monthStart}T00:00:00`)
      .lte('created_at', `${monthEnd}T23:59:59`),
    // 確定シフト（出退勤基準比較用）
    db.from('shifts')
      .select('staff_id, date, start_time')
      .eq('tenant_id', TENANT_ID)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    // 承認済み店舗改善（EXP付与用）
    db.from('store_improvements')
      .select('staff_id, exp_reward')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'approved')
      .gte('reviewed_at', `${monthStart}T00:00:00`)
      .lte('reviewed_at', `${monthEnd}T23:59:59`),
  ])

  const staffList: { id: string; name: string }[] = staffRes.data ?? []
  const rpgMap: Record<string, { level: number; exp: number; title: string; badges: string[] }> = {}
  for (const r of (rpgRes.data ?? [])) {
    rpgMap[r.staff_id] = r
  }

  // 勤怠: スタッフ別に集計
  const attendanceMap: Record<string, {
    dates: string[]
    clockIns: string[]
    records: { date: string; clock_in: string | null; is_substitute: boolean }[]
  }> = {}
  for (const a of (attendanceRes.data ?? [])) {
    if (!attendanceMap[a.staff_id]) {
      attendanceMap[a.staff_id] = { dates: [], clockIns: [], records: [] }
    }
    attendanceMap[a.staff_id].dates.push(a.date)
    if (a.clock_in) attendanceMap[a.staff_id].clockIns.push(a.date)
    attendanceMap[a.staff_id].records.push({
      date: a.date,
      clock_in: a.clock_in ?? null,
      is_substitute: a.is_substitute ?? false,
    })
  }

  // 確定シフト: スタッフ×日付 → start_time のマップ
  const shiftMap: Record<string, Record<string, string>> = {}
  for (const s of (shiftsRes.data ?? [])) {
    if (!shiftMap[s.staff_id]) shiftMap[s.staff_id] = {}
    shiftMap[s.staff_id][s.date] = s.start_time  // "HH:MM:SS"
  }

  // 口コミ: スタッフ別に件数集計
  const reviewCountMap: Record<string, number> = {}
  for (const r of (reviewsRes.data ?? [])) {
    if (!reviewCountMap[r.staff_id]) reviewCountMap[r.staff_id] = 0
    reviewCountMap[r.staff_id]++
  }

  // 店舗改善: スタッフ別EXP合計
  const improvementExpMap: Record<string, number> = {}
  for (const imp of (improvementsRes.data ?? [])) {
    if (!imp.staff_id) continue
    improvementExpMap[imp.staff_id] = (improvementExpMap[imp.staff_id] ?? 0) + (imp.exp_reward ?? 0)
  }

  /** TIME文字列 "HH:MM:SS" を分に変換 */
  function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  /**
   * EXP計算（v2）
   * ① 口コミ +150
   * ② 出退勤（確定シフト基準）: 早い/時間通り +50 / 遅刻(5分超) −30 / シフトなし日 +20
   * ③ 代打 +200
   * ④ 改善承認 管理者設定EXP
   */
  function calcExp(staffId: string): number {
    const records     = attendanceMap[staffId]?.records ?? []
    const myShiftMap  = shiftMap[staffId] ?? {}
    const reviewCount = reviewCountMap[staffId] ?? 0
    const impExp      = improvementExpMap[staffId] ?? 0

    let exp = 0

    // ① 口コミ
    exp += reviewCount * 150

    // ② 出退勤 ③ 代打
    for (const rec of records) {
      // 代打ボーナス
      if (rec.is_substitute) {
        exp += 200
        continue  // 代打日は通常出勤EXPと重複させない
      }

      const shiftStart = myShiftMap[rec.date]  // 確定シフトの開始時刻

      if (!shiftStart) {
        // シフト未登録日の出勤（自主出勤など）→ 基本 +20
        exp += 20
        continue
      }

      if (!rec.clock_in) {
        // シフトがあるのに打刻なし → 遅刻扱い −30
        exp -= 30
        continue
      }

      const shiftMin   = timeToMinutes(shiftStart)
      const clockMin   = timeToMinutes(rec.clock_in)
      const diffMin    = clockMin - shiftMin  // 正=遅刻、負=早い

      if (diffMin <= 5) {
        exp += 50  // 早い or ±5分以内 → 出勤ボーナス
      } else {
        exp -= 30  // 5分超遅刻 → マイナス
      }
    }

    // ④ 店舗改善
    exp += impExp

    return Math.max(0, exp)  // 0未満にはしない
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

  // 遅刻ゼロ（確定シフトのある日に全て5分以内で出勤）
  function hasZeroLate(staffId: string): boolean {
    const records    = attendanceMap[staffId]?.records ?? []
    const myShiftMap = shiftMap[staffId] ?? {}
    const shiftDays  = records.filter(r => myShiftMap[r.date] && !r.is_substitute)
    if (shiftDays.length === 0) return false
    return shiftDays.every(r => {
      if (!r.clock_in || !myShiftMap[r.date]) return false
      const diff = timeToMinutes(r.clock_in) - timeToMinutes(myShiftMap[r.date])
      return diff <= 5
    })
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
