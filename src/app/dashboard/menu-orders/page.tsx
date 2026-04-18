export const dynamic = 'force-dynamic'

/**
 * 注文管理ダッシュボード（厨房・ホール用）
 * リアルタイムで入ってくる注文を管理する
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import MenuOrdersClient from './MenuOrdersClient'

const TENANT_ID = process.env.TENANT_ID!

async function getOrders() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const today = new Date().toISOString().split('T')[0]

  const { data: orders } = await db
    .from('customer_orders')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .gte('created_at', today + 'T00:00:00')
    .order('created_at', { ascending: false })

  return orders ?? []
}


export default async function MenuOrdersPage() {
  const orders = await getOrders()

  // キャンセル済みを除いた注文（新着順）
  const activeOrders = orders.filter(
    (o: { status: string }) => o.status !== 'cancelled'
  )
  const todayTotal = activeOrders.reduce(
    (s: number, o: { total_amount: number }) => s + o.total_amount, 0
  )

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">注文一覧</h1>
          <p className="text-sm text-gray-500">本日 {activeOrders.length}件 · ¥{todayTotal.toLocaleString()}</p>
        </div>
        <a href="/menu?table=1" target="_blank"
          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold">
          🍜 メニュー確認
        </a>
      </div>

      <MenuOrdersClient orders={activeOrders} />

      <DashboardNav current="/dashboard/menu-orders" />
    </main>
  )
}
