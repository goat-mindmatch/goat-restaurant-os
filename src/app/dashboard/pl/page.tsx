export const dynamic = 'force-dynamic'

/**
 * PL（損益計算書）ダッシュボード
 * - 売上: daily_sales から自動集計
 * - 食材費・人件費: daily_sales.food_cost / labor_cost
 * - 経費: expenses テーブル（レシートOCR + 手動入力）
 * - 固定費: fixed_costs テーブル
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import PLClient from './PLClient'

const TENANT_ID = process.env.TENANT_ID!

async function getPLData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const firstDay = month + '-01'
  const lastDay = now.toISOString().split('T')[0]

  const [salesRes, expensesRes, fixedCostsRes] = await Promise.all([
    db.from('daily_sales')
      .select('store_sales, delivery_sales, food_cost, labor_cost')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay),
    db.from('expenses')
      .select('*, staff:recorded_by(name)')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false }),
    db.from('fixed_costs')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true),
  ])

  const sales = salesRes.data ?? []
  const expenses = expensesRes.data ?? []
  const fixedCosts = fixedCostsRes.data ?? []

  // 売上集計
  const storeRevenue = sales.reduce((s: number, d: { store_sales: number }) => s + (d.store_sales ?? 0), 0)
  const deliveryRevenue = sales.reduce((s: number, d: { delivery_sales: number }) => s + (d.delivery_sales ?? 0), 0)
  const totalRevenue = storeRevenue + deliveryRevenue

  // 食材費・人件費（daily_salesから）
  const foodFromSales = sales.reduce((s: number, d: { food_cost: number | null }) => s + (d.food_cost ?? 0), 0)
  const laborFromSales = sales.reduce((s: number, d: { labor_cost: number | null }) => s + (d.labor_cost ?? 0), 0)

  // 経費カテゴリ別集計（expensesから）
  const expByCategory: Record<string, number> = {}
  for (const exp of expenses) {
    const cat = exp.category as string
    expByCategory[cat] = (expByCategory[cat] ?? 0) + Number(exp.amount)
  }

  // 食材費: daily_salesのfood_cost + expensesのfoodカテゴリ（二重計上防止のためどちらかを使用）
  const foodCost = foodFromSales > 0 ? foodFromSales : (expByCategory['food'] ?? 0)
  const laborCost = laborFromSales > 0 ? laborFromSales : 0

  // 固定費合計（家賃は fixed_costs から、expenses.rent は除く）
  const fixedTotal = fixedCosts
    .filter((f: { category: string }) => f.category !== 'rent')
    .reduce((s: number, f: { amount: number }) => s + f.amount, 0)
  const rentFixed = fixedCosts
    .filter((f: { category: string }) => f.category === 'rent')
    .reduce((s: number, f: { amount: number }) => s + f.amount, 0)

  const costs = {
    food: foodCost,
    labor: laborCost,
    utility: expByCategory['utility'] ?? 0,
    consumable: expByCategory['consumable'] ?? 0,
    equipment: expByCategory['equipment'] ?? 0,
    rent: expByCategory['rent'] ?? 0,
    communication: expByCategory['communication'] ?? 0,
    other: expByCategory['other'] ?? 0,
    fixedTotal: fixedTotal + rentFixed,
  }

  const totalCosts = Object.values(costs).reduce((s, v) => s + v, 0)
  const grossProfit = totalRevenue - foodCost
  const operatingProfit = totalRevenue - totalCosts

  const flRatio = totalRevenue > 0
    ? Math.round(((foodCost + laborCost) / totalRevenue) * 100)
    : null

  return {
    month,
    revenue: { store: storeRevenue, delivery: deliveryRevenue, total: totalRevenue },
    costs,
    grossProfit,
    operatingProfit,
    flRatio,
    expenses,
  }
}


export default async function PLPage() {
  const data = await getPLData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">損益計算書（PL）</h1>
        <p className="text-sm text-gray-500">{data.month} の損益状況</p>
      </div>

      <PLClient data={data} />

      <DashboardNav current="/dashboard/pl" />
    </main>
  )
}
