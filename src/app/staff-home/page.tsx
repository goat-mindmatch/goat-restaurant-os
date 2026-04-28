export const dynamic = 'force-dynamic'

/**
 * /staff-home
 * スタッフ専用ホーム画面
 * - 今日のシフト
 * - 今月のランキング（上位5名）
 * - 意見箱・マニュアルへのアクセス
 */

import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import StaffHomeClient from './StaffHomeClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function StaffHomePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const session = await getSession()

  const jst   = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = jst.toISOString().split('T')[0]
  const thisYear  = jst.getUTCFullYear()
  const thisMonth = jst.getUTCMonth() + 1
  const monthStart = `${thisYear}-${String(thisMonth).padStart(2, '0')}-01`
  const monthEnd   = `${thisYear}-${String(thisMonth).padStart(2, '0')}-${String(new Date(thisYear, thisMonth, 0).getDate()).padStart(2, '0')}`

  const [shiftsRes, attendanceRes, reviewsRes, pendingImprovementsRes] = await Promise.all([
    // 今日の確定シフト
    db.from('shifts')
      .select('staff_id, start_time, end_time, role_on_day, staff:staff_id(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('date', today)
      .order('start_time'),
    // 今月の出勤日数
    db.from('attendance')
      .select('staff_id, date, clock_in')
      .eq('tenant_id', TENANT_ID)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    // 今月の口コミ（承認済み）
    db.from('review_submissions')
      .select('staff_id')
      .eq('tenant_id', TENANT_ID)
      .eq('verified', true)
      .gte('created_at', `${monthStart}T00:00:00`)
      .lte('created_at', `${monthEnd}T23:59:59`),
    // 未対応の改善申告数
    db.from('store_improvements')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'pending'),
  ])

  // 出勤日数集計
  const workDayMap: Record<string, number> = {}
  for (const a of (attendanceRes.data ?? [])) {
    workDayMap[a.staff_id] = (workDayMap[a.staff_id] ?? 0) + 1
  }

  // 口コミ件数集計
  const reviewMap: Record<string, number> = {}
  for (const r of (reviewsRes.data ?? [])) {
    reviewMap[r.staff_id] = (reviewMap[r.staff_id] ?? 0) + 1
  }

  // 簡易EXP計算（口コミ×150 + 出勤×50）でランキング
  const staffIds = Array.from(new Set([
    ...Object.keys(workDayMap),
    ...Object.keys(reviewMap),
  ]))

  // スタッフ名を取得
  const { data: staffList } = await db
    .from('staff')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)

  const staffNameMap: Record<string, string> = {}
  for (const s of (staffList ?? [])) {
    staffNameMap[s.id] = s.name
  }

  const rankings = staffIds
    .map(id => {
      const workDays = workDayMap[id] ?? 0
      const reviews  = reviewMap[id] ?? 0
      const exp      = workDays * 50 + reviews * 150
      const level    = Math.floor(exp / 1000) + 1
      return { id, name: staffNameMap[id] ?? '不明', exp, level, workDays, reviews }
    })
    .filter(s => s.name !== '不明')
    .sort((a, b) => b.exp - a.exp)
    .slice(0, 5)

  return (
    <StaffHomeClient
      staffName={session?.name ?? null}
      todayShifts={shiftsRes.data ?? []}
      rankings={rankings}
      pendingImprovements={pendingImprovementsRes.data?.length ?? 0}
      today={today}
      currentMonth={`${thisMonth}月`}
    />
  )
}
