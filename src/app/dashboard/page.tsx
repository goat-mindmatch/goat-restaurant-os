/**
 * 管理ダッシュボード トップ（本格版）
 * - 本日売上・目標達成率
 * - 7日間トレンドグラフ（CSS棒グラフ）
 * - FL比率・人件費管理
 * - 本日の出勤状況
 * - テーブル空席状況・呼び出し件数・スタッフ別口コミ数
 */
export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import DashboardClient from './DashboardClient'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'

async function getDashboardData() {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const today = new Date().toISOString().split('T')[0]
  const firstDayOfMonth = today.slice(0, 7) + '-01'

  // 7日前
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  const [todaySalesRes, monthSalesRes, weekSalesRes, todayAttendanceRes, tenantRes, monthShiftsRes, tablesRes, pendingCallsRes, todayReviewsRes] =
    await Promise.all([
      db.from('daily_sales')
        .select('total_sales, store_sales, delivery_sales, store_orders, delivery_orders, uber_sales, rocketnow_sales, menu_sales, lunch_sales, dinner_sales, ai_comment')
        .eq('tenant_id', TENANT_ID).eq('date', today).single() as Promise<{ data: TodaySales | null }>,
      db.from('daily_sales')
        .select('total_sales, food_cost, labor_cost')
        .eq('tenant_id', TENANT_ID).gte('date', firstDayOfMonth).lte('date', today) as Promise<{ data: MonthSales[] | null }>,
      db.from('daily_sales')
        .select('date, total_sales, store_sales, delivery_sales')
        .eq('tenant_id', TENANT_ID).gte('date', sevenDaysAgoStr).lte('date', today)
        .order('date', { ascending: true }) as Promise<{ data: WeekSales[] | null }>,
      db.from('attendance')
        .select('staff_id, clock_in, clock_out, staff(name)')
        .eq('tenant_id', TENANT_ID).eq('date', today) as Promise<{ data: AttendanceRow[] | null }>,
      db.from('tenants')
        .select('monthly_target, name').eq('id', TENANT_ID).single() as Promise<{ data: { monthly_target: number; name: string } | null }>,
      db.from('shifts')
        .select('start_time, end_time, staff(hourly_wage)')
        .eq('tenant_id', TENANT_ID)
        .gte('date', firstDayOfMonth)
        .lte('date', today) as Promise<{ data: ShiftRow[] | null }>,
      // テーブル一覧（空席/満席カウント用）
      db.from('tables')
        .select('id, status')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true) as Promise<{ data: { id: string; status: string }[] | null }>,
      // 未対応呼び出し件数
      db.from('table_calls')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .eq('status', 'pending') as Promise<{ data: { id: string }[] | null }>,
      // 今日のスタッフ別口コミ提出数
      db.from('review_submissions')
        .select('staff_id, staff(name)')
        .eq('tenant_id', TENANT_ID)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59') as Promise<{ data: { staff_id: string; staff: { name: string } | null }[] | null }>,
    ])

  const monthTotal    = monthSalesRes.data?.reduce((s: number, d: MonthSales) => s + (d.total_sales ?? 0), 0) ?? 0
  const monthFoodCost = monthSalesRes.data?.reduce((s: number, d: MonthSales) => s + (d.food_cost ?? 0), 0) ?? 0
  const monthLaborCost = monthSalesRes.data?.reduce((s: number, d: MonthSales) => s + (d.labor_cost ?? 0), 0) ?? 0

  const monthlyTarget = tenantRes.data?.monthly_target ?? 0
  const tenantName    = tenantRes.data?.name ?? '人類みなまぜそば'

  // 日割り目標（今月の日数で割る）
  const daysInMonth = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
    0
  ).getDate()
  const todayNum = Number(today.slice(8, 10))
  const dailyTarget = monthlyTarget > 0 ? Math.round(monthlyTarget / daysInMonth) : 0
  const todaySalesAmt = todaySalesRes.data?.total_sales ?? 0
  const achievementRate = dailyTarget > 0 ? Math.round((todaySalesAmt / dailyTarget) * 100) : null

  // 月次達成率
  const monthAchievementRate = monthlyTarget > 0
    ? Math.round((monthTotal / monthlyTarget) * 100)
    : null

  // 残り使える人件費（25%ルール）
  const laborBudget = monthlyTarget > 0 ? Math.round(monthlyTarget * 0.25) : 0
  // シフトベースの推定人件費
  let estimatedLaborCost = 0
  const DEFAULT_WAGE = 1200
  for (const s of monthShiftsRes.data ?? []) {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    const hours = (eh * 60 + em - sh * 60 - sm) / 60
    if (hours <= 0) continue
    const wage = s.staff?.hourly_wage ?? DEFAULT_WAGE
    const lateHours = Math.max(0, (eh + em / 60) - 22)
    const normalHours = hours - lateHours
    estimatedLaborCost += normalHours * wage + lateHours * wage * 1.25
  }
  const remainingLaborBudget = laborBudget - Math.round(estimatedLaborCost)
  const laborRatio = monthTotal > 0
    ? Math.round((estimatedLaborCost / monthTotal) * 100)
    : monthlyTarget > 0
      ? Math.round((estimatedLaborCost / monthlyTarget) * 100)
      : null

  // 週次トレンド（7日分）
  const weekData = weekSalesRes.data ?? []
  const maxWeekSales = Math.max(...weekData.map((d: WeekSales) => d.total_sales ?? 0), 1)

  // テーブル空席/満席
  const allTables = tablesRes.data ?? []
  const emptyTableCount    = allTables.filter(t => t.status === 'empty').length
  const occupiedTableCount = allTables.filter(t => t.status !== 'empty').length
  const totalTableCount    = allTables.length

  // 未対応呼び出し件数
  const pendingCallCount = pendingCallsRes.data?.length ?? 0

  // スタッフ別口コミ件数（上位3名）
  const reviewMap: Record<string, { name: string; count: number }> = {}
  for (const r of todayReviewsRes.data ?? []) {
    const sid = r.staff_id
    if (!reviewMap[sid]) {
      reviewMap[sid] = { name: r.staff?.name ?? '不明', count: 0 }
    }
    reviewMap[sid].count++
  }
  const reviewRanking = Object.values(reviewMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  return {
    today: {
      sales: todaySalesAmt,
      storeOrders: todaySalesRes.data?.store_orders ?? 0,
      deliveryOrders: todaySalesRes.data?.delivery_orders ?? 0,
      lunchSales: todaySalesRes.data?.lunch_sales ?? 0,
      dinnerSales: todaySalesRes.data?.dinner_sales ?? 0,
      aiComment: todaySalesRes.data?.ai_comment ?? null,
    },
    target: {
      daily: dailyTarget,
      monthly: monthlyTarget,
      achievementRate,
      monthAchievementRate,
    },
    month: {
      sales: monthTotal,
      foodCost: monthFoodCost,
      laborCost: monthLaborCost,
      flRatio: monthTotal > 0
        ? Math.round(((monthFoodCost + monthLaborCost) / monthTotal) * 100)
        : null,
      daysElapsed: todayNum,
      daysInMonth,
    },
    labor: {
      budget: laborBudget,
      estimated: Math.round(estimatedLaborCost),
      remaining: remainingLaborBudget,
      ratio: laborRatio,
    },
    week: {
      data: weekData,
      max: maxWeekSales,
    },
    attendance: todayAttendanceRes.data ?? [],
    // 追加データ
    tenantName,
    tables: {
      empty: emptyTableCount,
      occupied: occupiedTableCount,
      total: totalTableCount,
    },
    pendingCallCount,
    reviewRanking,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const updatedAt = new Date().toLocaleString('ja-JP', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }) + ' 更新'

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <DashboardClient data={{ ...data, updatedAt }} />
      <DashboardNav current="/dashboard" />
    </main>
  )
}

type TodaySales = {
  total_sales: number
  store_sales: number
  delivery_sales: number
  store_orders: number
  delivery_orders: number
  uber_sales: number
  rocketnow_sales: number
  menu_sales: number
  lunch_sales: number
  dinner_sales: number
  ai_comment: string | null
}

type MonthSales = {
  total_sales: number | null
  food_cost: number | null
  labor_cost: number | null
}

type WeekSales = {
  date: string
  total_sales: number | null
  store_sales: number | null
  delivery_sales: number | null
}

type AttendanceRow = {
  staff_id: string
  clock_in: string | null
  clock_out: string | null
  staff: { name: string } | null
}

type ShiftRow = {
  start_time: string
  end_time: string
  staff: { hourly_wage?: number } | null
}
