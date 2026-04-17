export const dynamic = 'force-dynamic'

/**
 * 注文管理ダッシュボード（厨房・ホール用）
 * リアルタイムで入ってくる注文を管理する
 */

import { createServiceClient } from '@/lib/supabase'
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

const NAV_ITEMS = [
  { label: 'ホーム', href: '/dashboard', icon: '🏠' },
  { label: 'シフト', href: '/dashboard/shifts', icon: '📅' },
  { label: '注文', href: '/dashboard/menu-orders', icon: '🍜' },
  { label: 'PL', href: '/dashboard/pl', icon: '📋' },
  { label: '給与', href: '/dashboard/payroll', icon: '💴' },
]

export default async function MenuOrdersPage() {
  const orders = await getOrders()

  const pending = orders.filter((o: { status: string }) => o.status === 'pending' || o.status === 'confirmed')
  const cooking = orders.filter((o: { status: string }) => o.status === 'cooking')
  const done = orders.filter((o: { status: string }) => o.status === 'ready' || o.status === 'served')
  const todayTotal = orders.reduce((s: number, o: { total_amount: number }) => s + o.total_amount, 0)

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">注文管理</h1>
          <p className="text-sm text-gray-500">本日 {orders.length}件 · ¥{todayTotal.toLocaleString()}</p>
        </div>
        <a href="/menu?table=99" target="_blank"
          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold">
          🍜 メニューを見る
        </a>
      </div>

      <MenuOrdersClient
        pendingOrders={pending}
        cookingOrders={cooking}
        doneOrders={done}
      />

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {NAV_ITEMS.map(item => (
            <a key={item.href} href={item.href}
              className={`flex flex-col items-center py-1 text-xs hover:text-gray-900 ${
                item.href === '/dashboard/menu-orders' ? 'text-orange-600 font-semibold' : 'text-gray-500'
              }`}>
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  )
}
