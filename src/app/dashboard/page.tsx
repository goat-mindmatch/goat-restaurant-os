/**
 * 管理ダッシュボード トップ
 * Phase 1: シンプルな構成。Phase 3でグラフ・AI分析を追加。
 */
export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'

async function getDashboardData() {
  const supabase = createServiceClient()

  const today = new Date().toISOString().split('T')[0]
  const firstDayOfMonth = today.slice(0, 7) + '-01'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [todaySalesRes, monthSalesRes, todayAttendanceRes] = await Promise.all([
    db.from('daily_sales')
      .select('total_sales, store_orders, delivery_orders, ai_comment')
      .eq('tenant_id', TENANT_ID)
      .eq('date', today)
      .single() as Promise<{ data: TodaySales | null }>,
    db.from('daily_sales')
      .select('total_sales, food_cost, labor_cost')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDayOfMonth)
      .lte('date', today) as Promise<{ data: MonthSales[] | null }>,
    db.from('attendance')
      .select('staff_id, clock_in, clock_out, staff(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('date', today) as Promise<{ data: AttendanceRow[] | null }>,
  ])

  const monthTotal = monthSalesRes.data?.reduce((sum: number, d: MonthSales) => sum + (d.total_sales ?? 0), 0) ?? 0
  const monthFoodCost = monthSalesRes.data?.reduce((sum: number, d: MonthSales) => sum + (d.food_cost ?? 0), 0) ?? 0
  const monthLaborCost = monthSalesRes.data?.reduce((sum: number, d: MonthSales) => sum + (d.labor_cost ?? 0), 0) ?? 0

  return {
    today: {
      sales: todaySalesRes.data?.total_sales ?? 0,
      storeOrders: todaySalesRes.data?.store_orders ?? 0,
      deliveryOrders: todaySalesRes.data?.delivery_orders ?? 0,
      aiComment: todaySalesRes.data?.ai_comment ?? null,
    },
    month: {
      sales: monthTotal,
      foodCost: monthFoodCost,
      laborCost: monthLaborCost,
      flRatio: monthTotal > 0
        ? Math.round(((monthFoodCost + monthLaborCost) / monthTotal) * 100)
        : null,
    },
    attendance: todayAttendanceRes.data ?? [],
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const flColor = data.month.flRatio
    ? data.month.flRatio <= 55 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-400'

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GOAT Restaurant OS</h1>
        <p className="text-sm text-gray-500">人類みなまぜそば — 管理ダッシュボード</p>
      </div>

      {/* 今日の売上 */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">本日の売上</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">売上合計</p>
            <p className="text-2xl font-bold text-gray-900">
              ¥{data.today.sales.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">店内注文</p>
            <p className="text-2xl font-bold text-gray-900">{data.today.storeOrders}件</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">デリバリー</p>
            <p className="text-2xl font-bold text-gray-900">{data.today.deliveryOrders}件</p>
          </div>
        </div>
      </section>

      {/* AI日報コメント */}
      {data.today.aiComment && (
        <section className="mb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 mb-1">AI 日報コメント</p>
            <p className="text-sm text-blue-800">{data.today.aiComment}</p>
          </div>
        </section>
      )}

      {/* 月次FL比率 */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">月次 FL 管理</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">月次売上</p>
            <p className="text-xl font-bold text-gray-900">
              ¥{data.month.sales.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">FL比率 (目標 ≤55%)</p>
            <p className={`text-xl font-bold ${flColor}`}>
              {data.month.flRatio !== null ? `${data.month.flRatio}%` : 'データなし'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">食材費 (F)</p>
            <p className="text-lg font-semibold text-gray-700">
              ¥{data.month.foodCost.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">人件費 (L)</p>
            <p className="text-lg font-semibold text-gray-700">
              ¥{data.month.laborCost.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* 本日の出勤状況 */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">本日の出勤状況</h2>
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
        <h2 className="text-sm font-semibold text-gray-500 mb-2">管理メニュー</h2>
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
  store_orders: number
  delivery_orders: number
  ai_comment: string | null
}

type MonthSales = {
  total_sales: number | null
  food_cost: number | null
  labor_cost: number | null
}

type AttendanceRow = {
  staff_id: string
  clock_in: string | null
  clock_out: string | null
  staff: { name: string } | null
}
