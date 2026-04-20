export const dynamic = 'force-dynamic'

/**
 * PL（損益計算書）ダッシュボード — 完全自動連携版
 *
 * 収入:
 *   - daily_sales（手入力: 店内/Uber/menu等）
 *   - customer_orders（テーブルQR注文: 会計完了分）
 *
 * 費用:
 *   - 人件費: staff × attendance から給与計算システムと同じロジックで自動算出
 *   - 食材費: daily_sales.food_cost（手入力）
 *   - 変動費: expenses（レシートOCR + 手動）
 *   - 固定費: fixed_costs（登録済み固定費）
 *
 * ?month=YYYY-MM で月切り替え可能
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import PLClient from './PLClient'

const TENANT_ID = process.env.TENANT_ID!

function calcLateNightMinutes(clockIn: string | null, clockOut: string | null): number {
  if (!clockIn || !clockOut) return 0
  const [inH, inM] = clockIn.split(':').map(Number)
  const [outH, outM] = clockOut.split(':').map(Number)
  const endMin = outH * 60 + outM
  const lateStart = 22 * 60
  if (endMin <= lateStart) return 0
  const effectiveStart = Math.max(inH * 60 + inM, lateStart)
  return Math.max(0, endMin - effectiveStart)
}

async function getPLData(month: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const firstDay = month + '-01'
  const lastDayNum = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const lastDay = `${month}-${String(lastDayNum).padStart(2, '0')}`
  const firstDayISO = firstDay + 'T00:00:00'
  const lastDayISO  = lastDay  + 'T23:59:59'

  const [
    salesRes, expensesRes, fixedCostsRes,
    staffRes, attendanceRes, reviewsRes, ordersRes,
  ] = await Promise.all([
    // 手入力売上
    db.from('daily_sales')
      .select('store_sales, delivery_sales, food_cost, labor_cost, uber_sales, menu_sales, rocketnow_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay),
    // 変動経費（レシートOCR + 手動）
    db.from('expenses')
      .select('*, staff:recorded_by(name)')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false }),
    // 固定費マスタ
    db.from('fixed_costs')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true),
    // スタッフ（給与計算用）
    db.from('staff')
      .select('id, name, hourly_wage, transport_fee')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true),
    // 勤怠（給与計算用）
    db.from('attendance')
      .select('staff_id, date, clock_in, clock_out, work_minutes, break_minutes')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay),
    // 口コミ獲得数（ボーナス計算用）
    db.from('review_submissions')
      .select('assigned_staff_id')
      .eq('tenant_id', TENANT_ID)
      .eq('verified', true)
      .gte('created_at', firstDayISO)
      .lte('created_at', lastDayISO),
    // テーブルQR注文（会計完了分）
    db.from('customer_orders')
      .select('total_amount, status')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'served')
      .gte('created_at', firstDayISO)
      .lte('created_at', lastDayISO),
  ])

  const sales      = salesRes.data ?? []
  const expenses   = expensesRes.data ?? []
  const fixedCosts = fixedCostsRes.data ?? []
  const staffList  = staffRes.data ?? []
  const attendance = attendanceRes.data ?? []
  const reviews    = reviewsRes.data ?? []
  const orders     = ordersRes.data ?? []

  /* ── 売上集計 ── */
  const storeRevenue    = sales.reduce((s: number, d: Record<string, number>) => s + (d.store_sales ?? 0), 0)
  const deliveryRevenue = sales.reduce((s: number, d: Record<string, number>) => s + (d.delivery_sales ?? 0), 0)
  const tableRevenue    = orders.reduce((s: number, o: { total_amount: number }) => s + (o.total_amount ?? 0), 0)
  const totalRevenue    = storeRevenue + deliveryRevenue + tableRevenue

  /* ── 食材費（daily_salesのfood_cost優先） ── */
  const foodFromSales = sales.reduce((s: number, d: Record<string, number | null>) => s + (Number(d.food_cost) || 0), 0)
  const expByCategory: Record<string, number> = {}
  for (const exp of expenses) {
    const cat = exp.category as string
    expByCategory[cat] = (expByCategory[cat] ?? 0) + Number(exp.amount)
  }
  const foodCost = foodFromSales > 0 ? foodFromSales : (expByCategory['food'] ?? 0)

  /* ── 人件費：給与計算システムと同じロジックで自動算出 ── */
  const reviewCountMap: Record<string, number> = {}
  for (const r of reviews) {
    const sid = r.assigned_staff_id as string
    if (sid) reviewCountMap[sid] = (reviewCountMap[sid] ?? 0) + 1
  }

  let laborCostFromPayroll = 0
  const payrollBreakdown: Array<{ name: string; total: number }> = []

  for (const staff of staffList) {
    const myAtt = attendance.filter(
      (a: Record<string, unknown>) => a.staff_id === staff.id && a.work_minutes
    )
    const totalMinutes  = myAtt.reduce((s: number, a: Record<string, number>) => s + (a.work_minutes ?? 0), 0)
    const totalDays     = myAtt.length
    const totalHours    = totalMinutes / 60
    const lateNightMin  = myAtt.reduce(
      (s: number, a: Record<string, string | null>) =>
        s + calcLateNightMinutes(a.clock_in, a.clock_out), 0
    )
    const lateNightHours = lateNightMin / 60
    const wage           = staff.hourly_wage ?? 0
    const transport      = staff.transport_fee ?? 0
    const basePay        = Math.round(totalHours * wage)
    const lateNightPremium = Math.round(lateNightHours * wage * 0.25)
    const transportTotal = totalDays * transport
    const reviewBonus    = (reviewCountMap[staff.id] ?? 0) * 100
    const total          = basePay + lateNightPremium + transportTotal + reviewBonus
    laborCostFromPayroll += total
    if (total > 0) payrollBreakdown.push({ name: staff.name, total })
  }

  // daily_salesのlabor_costが手入力されていればそちらを優先
  const laborFromSales = sales.reduce((s: number, d: Record<string, number | null>) => s + (Number(d.labor_cost) || 0), 0)
  const laborCost = laborFromSales > 0 ? laborFromSales : laborCostFromPayroll

  /* ── 固定費集計 ── */
  const fixedTotal = fixedCosts
    .filter((f: { category: string }) => f.category !== 'rent')
    .reduce((s: number, f: { amount: number }) => s + f.amount, 0)
  const rentFixed = fixedCosts
    .filter((f: { category: string }) => f.category === 'rent')
    .reduce((s: number, f: { amount: number }) => s + f.amount, 0)

  const costs = {
    food:          foodCost,
    labor:         laborCost,
    utility:       expByCategory['utility']      ?? 0,
    consumable:    expByCategory['consumable']   ?? 0,
    equipment:     expByCategory['equipment']    ?? 0,
    rent:          expByCategory['rent']         ?? 0,
    communication: expByCategory['communication'] ?? 0,
    other:         expByCategory['other']        ?? 0,
    fixedTotal:    fixedTotal + rentFixed,
  }

  const totalCosts       = Object.values(costs).reduce((s, v) => s + v, 0)
  const grossProfit      = totalRevenue - foodCost
  const operatingProfit  = totalRevenue - totalCosts
  const flRatio          = totalRevenue > 0
    ? Math.round(((foodCost + laborCost) / totalRevenue) * 100)
    : null

  return {
    month,
    revenue: {
      store:    storeRevenue,
      delivery: deliveryRevenue,
      table:    tableRevenue,
      total:    totalRevenue,
    },
    costs,
    grossProfit,
    operatingProfit,
    flRatio,
    expenses,
    payrollBreakdown,
    laborSource: laborFromSales > 0 ? 'manual' : (laborCostFromPayroll > 0 ? 'payroll' : 'none') as 'manual' | 'payroll' | 'none',
  }
}

export default async function PLPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: qMonth } = await searchParams
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const month = qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : currentMonth

  const data = await getPLData(month)

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">損益計算書（PL）</h1>
        <p className="text-sm text-gray-500">{data.month} の損益状況</p>
      </div>

      <PLClient data={data} currentMonth={currentMonth} />

      <DashboardNav current="/dashboard/pl" />
    </main>
  )
}
