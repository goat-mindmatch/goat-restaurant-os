/**
 * 管理ダッシュボード トップ（本格版）
 * - 本日売上・目標達成率
 * - 7日間トレンドグラフ（CSS棒グラフ）
 * - FL比率・人件費管理
 * - 本日の出勤状況
 */
export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'

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

  const [todaySalesRes, monthSalesRes, weekSalesRes, todayAttendanceRes, tenantRes, monthShiftsRes] =
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
        .select('monthly_target').eq('id', TENANT_ID).single() as Promise<{ data: { monthly_target: number } | null }>,
      db.from('shifts')
        .select('start_time, end_time, staff(hourly_wage)')
        .eq('tenant_id', TENANT_ID)
        .gte('date', firstDayOfMonth)
        .lte('date', today) as Promise<{ data: ShiftRow[] | null }>,
    ])

  const monthTotal    = monthSalesRes.data?.reduce((s: number, d: MonthSales) => s + (d.total_sales ?? 0), 0) ?? 0
  const monthFoodCost = monthSalesRes.data?.reduce((s: number, d: MonthSales) => s + (d.food_cost ?? 0), 0) ?? 0
  const monthLaborCost = monthSalesRes.data?.reduce((s: number, d: MonthSales) => s + (d.labor_cost ?? 0), 0) ?? 0

  const monthlyTarget = tenantRes.data?.monthly_target ?? 0

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
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const flColor = data.month.flRatio !== null
    ? data.month.flRatio <= 55 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-400'

  const achieveColor = data.target.achievementRate !== null
    ? data.target.achievementRate >= 100 ? 'text-green-600'
    : data.target.achievementRate >= 80  ? 'text-yellow-600'
    : 'text-red-500'
    : 'text-gray-400'

  const laborColor = data.labor.ratio !== null
    ? data.labor.ratio <= 25 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-400'

  const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* ヘッダー */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">GOAT Restaurant OS</h1>
        <p className="text-sm text-gray-500">人類みなまぜそば — 管理ダッシュボード</p>
      </div>

      {/* 今日の売上 + 目標達成率 */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 mb-2">本日の売上</h2>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-white rounded-xl p-4 shadow-sm col-span-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-400">売上合計</p>
                <p className="text-3xl font-black text-gray-900">¥{data.today.sales.toLocaleString()}</p>
                {data.today.lunchSales > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    ☀️昼 ¥{data.today.lunchSales.toLocaleString()} / 🌙夜 ¥{data.today.dinnerSales.toLocaleString()}
                  </p>
                )}
              </div>
              {data.target.achievementRate !== null && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">日次目標達成率</p>
                  <p className={`text-3xl font-black ${achieveColor}`}>{data.target.achievementRate}%</p>
                  <p className="text-xs text-gray-400">目標 ¥{data.target.daily.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-400">店内注文</p>
            <p className="text-xl font-bold text-gray-900">{data.today.storeOrders}件</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-400">デリバリー</p>
            <p className="text-xl font-bold text-gray-900">{data.today.deliveryOrders}件</p>
          </div>
        </div>
      </section>

      {/* AI日報コメント */}
      {data.today.aiComment && (
        <section className="mb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 mb-1">🤖 AI 日報コメント</p>
            <p className="text-sm text-blue-800">{data.today.aiComment}</p>
          </div>
        </section>
      )}

      {/* 7日間トレンドグラフ */}
      {data.week.data.length > 0 && (
        <section className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 mb-2">直近7日間の売上推移</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-end justify-between gap-1 h-24">
              {data.week.data.map((d: WeekSales) => {
                const pct = Math.max(4, Math.round(((d.total_sales ?? 0) / data.week.max) * 100))
                const date = new Date(d.date + 'T00:00:00')
                const dow = DAYS_JP[date.getDay()]
                const dayNum = d.date.slice(8)
                const isToday = d.date === new Date().toISOString().split('T')[0]
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[10px] text-gray-500 leading-none">
                      ¥{Math.round((d.total_sales ?? 0) / 1000)}k
                    </p>
                    <div className="w-full flex items-end" style={{ height: '56px' }}>
                      <div
                        className={`w-full rounded-t-sm ${isToday ? 'bg-blue-500' : 'bg-gray-300'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <p className={`text-[10px] font-semibold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                      {dayNum}/{dow}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 月次サマリー */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 mb-2">月次 FL 管理</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">月次売上</p>
            <p className="text-xl font-bold text-gray-900">¥{data.month.sales.toLocaleString()}</p>
            {data.target.monthAchievementRate !== null && (
              <p className="text-xs text-gray-400 mt-0.5">
                目標達成率 <span className={
                  data.target.monthAchievementRate >= 100 ? 'text-green-600 font-bold' : 'text-orange-500 font-bold'
                }>{data.target.monthAchievementRate}%</span>
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">FL比率 (目標 ≤55%)</p>
            <p className={`text-xl font-bold ${flColor}`}>
              {data.month.flRatio !== null ? `${data.month.flRatio}%` : 'データなし'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">食材費 (F)</p>
            <p className="text-lg font-semibold text-gray-700">¥{data.month.foodCost.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">人件費 (L)</p>
            <p className="text-lg font-semibold text-gray-700">¥{data.month.laborCost.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* 人件費率リアルタイム */}
      {data.target.monthly > 0 && (
        <section className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 mb-2">人件費率リアルタイム</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-gray-400">シフト推定人件費</p>
                <p className={`text-2xl font-bold ${laborColor}`}>
                  {data.labor.ratio !== null ? `${data.labor.ratio}%` : '—'}
                </p>
                <p className="text-xs text-gray-400">目標 25% 以内</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">残り使える人件費</p>
                <p className={`text-xl font-bold ${data.labor.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.labor.remaining >= 0 ? '+' : ''}¥{data.labor.remaining.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">予算 ¥{data.labor.budget.toLocaleString()}</p>
              </div>
            </div>
            {/* プログレスバー */}
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (data.labor.ratio ?? 0) <= 25 ? 'bg-green-400' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, data.labor.ratio ?? 0) * 4}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0%</span>
              <span className="text-green-600 font-bold">目標25%</span>
              <span>30%+</span>
            </div>
          </div>
        </section>
      )}

      {/* 本日の出勤状況 */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 mb-2">本日の出勤状況</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {data.attendance.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">本日の打刻データなし</p>
          ) : (
            data.attendance.map((a: AttendanceRow) => (
              <div key={a.staff_id} className="flex items-center justify-between p-4">
                <span className="text-sm font-medium text-gray-800">
                  {(a.staff as { name: string } | null)?.name ?? '不明'}
                </span>
                <span className="text-sm text-gray-500">
                  {a.clock_in ? a.clock_in.slice(0, 5) : '--:--'}
                  {' 〜 '}
                  {a.clock_out ? a.clock_out.slice(0, 5) : '勤務中'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* クイックリンク */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 mb-2">管理メニュー</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'シフト管理', href: '/dashboard/shifts',    icon: '📅', desc: '確定・編集' },
            { label: '給与計算',   href: '/dashboard/payroll',   icon: '💴', desc: '今月の給与' },
            { label: '在庫管理',   href: '/dashboard/inventory', icon: '📦', desc: '食材・消耗品' },
            { label: '口コミ',     href: '/dashboard/reviews',   icon: '⭐', desc: 'Google連携' },
            { label: 'レシート',   href: '/dashboard/receipts',  icon: '🧾', desc: '経費・OCR' },
            { label: '設定',       href: '/dashboard/settings',  icon: '⚙️', desc: 'LINE設定' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="bg-white rounded-xl p-3 shadow-sm text-center hover:bg-gray-50 transition-colors">
              <p className="text-2xl mb-1">{item.icon}</p>
              <p className="text-xs font-semibold text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* ナビゲーション */}
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
