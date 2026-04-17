export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {[
            { label: 'ホーム', href: '/dashboard', icon: '🏠' },
            { label: 'シフト', href: '/dashboard/shifts', icon: '📅' },
            { label: '発注', href: '/dashboard/orders', icon: '📦' },
            { label: 'PL', href: '/dashboard/pl', icon: '📋' },
            { label: '給与', href: '/dashboard/payroll', icon: '💴' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="flex flex-col items-center py-1 text-xs text-gray-500 hover:text-gray-900">
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  )
}
