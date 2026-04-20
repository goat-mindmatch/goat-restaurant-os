/**
 * AIメニューエンジニアリング
 * menu_items × customer_orders を4象限分類
 */
export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import MenuEngineeringClient from './MenuEngineeringClient'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'

export type MenuEngineeringItem = {
  id: string
  name: string
  category: string | null
  price: number
  cost_price: number | null
  profit_rate: number          // (price - cost) / price
  order_count: number
  quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog'
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

async function getMenuEngineeringData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // menu_items取得
  const { data: menuItems } = await db
    .from('menu_items')
    .select('id, name, category, price, cost_price')
    .eq('tenant_id', TENANT_ID)
    .eq('is_available', true) as { data: Array<{ id: string; name: string; category: string | null; price: number; cost_price: number | null }> | null }

  if (!menuItems || menuItems.length === 0) {
    return { items: [] as MenuEngineeringItem[], medianOrders: 0, medianProfitRate: 0 }
  }

  // 過去3ヶ月の注文数集計
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAgoStr = threeMonthsAgo.toISOString()

  const { data: orderItems } = await db
    .from('order_items')
    .select('menu_item_id, quantity, customer_orders!inner(tenant_id, created_at, status)')
    .eq('customer_orders.tenant_id', TENANT_ID)
    .gte('customer_orders.created_at', threeMonthsAgoStr)
    .eq('customer_orders.status', 'paid') as {
      data: Array<{ menu_item_id: string; quantity: number }> | null
    }

  // 注文数集計
  const orderCountMap: Record<string, number> = {}
  if (orderItems) {
    for (const oi of orderItems) {
      orderCountMap[oi.menu_item_id] = (orderCountMap[oi.menu_item_id] ?? 0) + oi.quantity
    }
  }

  // 利益率計算
  const itemsWithMetrics = menuItems.map(item => {
    const cost = item.cost_price ?? item.price * 0.5
    const profitRate = item.price > 0 ? (item.price - cost) / item.price : 0.5
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      cost_price: item.cost_price,
      profit_rate: Math.max(0, Math.min(1, profitRate)),
      order_count: orderCountMap[item.id] ?? 0,
    }
  })

  const medianOrders = median(itemsWithMetrics.map(i => i.order_count))
  const medianProfitRate = median(itemsWithMetrics.map(i => i.profit_rate))

  const items: MenuEngineeringItem[] = itemsWithMetrics.map(item => {
    const highOrders = item.order_count >= medianOrders
    const highProfit = item.profit_rate >= medianProfitRate
    let quadrant: MenuEngineeringItem['quadrant']
    if (highOrders && highProfit) quadrant = 'star'
    else if (highOrders && !highProfit) quadrant = 'plowhorse'
    else if (!highOrders && highProfit) quadrant = 'puzzle'
    else quadrant = 'dog'
    return { ...item, quadrant }
  })

  return { items, medianOrders, medianProfitRate }
}

export default async function MenuEngineeringPage() {
  const { items, medianOrders, medianProfitRate } = await getMenuEngineeringData()

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1">AIメニューエンジニアリング</h1>
        <p className="text-xs text-gray-500 mb-4">
          過去3ヶ月の注文データをもとに4象限分類 ／ 注文数中央値: {medianOrders.toFixed(0)}件 ／ 利益率中央値: {(medianProfitRate * 100).toFixed(1)}%
        </p>
        <MenuEngineeringClient
          items={items}
          medianOrders={medianOrders}
          medianProfitRate={medianProfitRate}
        />
      </div>
      <DashboardNav current="/dashboard/menu-engineering" />
    </main>
  )
}
