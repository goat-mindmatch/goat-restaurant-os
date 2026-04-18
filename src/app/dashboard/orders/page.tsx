export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import OrdersClient from './OrdersClient'

const TENANT_ID = process.env.TENANT_ID!

async function getOrdersData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const [ordersRes, suppliersRes] = await Promise.all([
    db.from('orders').select('*')
      .eq('tenant_id', TENANT_ID)
      .order('order_date', { ascending: false })
      .limit(30),
    db.from('suppliers').select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
  ])

  return {
    orders: ordersRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
  }
}

export default async function OrdersPage() {
  const { orders, suppliers } = await getOrdersData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">発注管理</h1>
        <p className="text-sm text-gray-500">取引先への発注・履歴</p>
      </div>

      <OrdersClient orders={orders} suppliers={suppliers} />

      <DashboardNav current="/dashboard/orders" />
    </main>
  )
}
