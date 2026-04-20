export const dynamic = 'force-dynamic'

/**
 * テーブル管理ページ
 * 各テーブルの注文状況・支払い状況をリアルタイム確認
 * 会計完了・割り勘計算・会計待ちフラグも対応
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import TablesClient from './TablesClient'
import Link from 'next/link'

const TENANT_ID = process.env.TENANT_ID!

async function getTables() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: tables, error } = await db
    .from('tables')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return []

  const today = new Date().toISOString().split('T')[0]
  const { data: orders } = await db
    .from('customer_orders')
    .select('id, table_number, items, total_amount, payment_method, status, note, created_at')
    .eq('tenant_id', TENANT_ID)
    .in('status', ['pending', 'confirmed', 'cooking', 'ready', 'waiting_payment'])
    .gte('created_at', today + 'T00:00:00')

  return (tables ?? []).map((t: Record<string, unknown>) => {
    const tableOrders = (orders ?? []).filter(
      (o: Record<string, unknown>) => Number(o.table_number) === Number(t.table_number)
    )
    const totalAmount = tableOrders.reduce(
      (s: number, o: Record<string, unknown>) => s + (Number(o.total_amount) || 0), 0
    )
    const hasWaiting = tableOrders.some((o: Record<string, unknown>) => o.status === 'waiting_payment')
    const isOccupied = tableOrders.length > 0
    return {
      ...t,
      orders: tableOrders,
      total_amount: totalAmount,
      order_count: tableOrders.length,
      status: hasWaiting ? 'waiting_payment' : isOccupied ? 'occupied' : 'empty',
    }
  })
}

export default async function TablesPage() {
  const tables = await getTables()

  const occupiedCount = tables.filter((t: { status: string }) => t.status !== 'empty').length
  const totalSales = tables.reduce(
    (s: number, t: { total_amount: number }) => s + (t.total_amount || 0), 0
  )

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🪑 テーブル管理</h1>
          <p className="text-sm text-gray-500">
            使用中 {occupiedCount}席 · 本日 ¥{totalSales.toLocaleString()}
          </p>
        </div>
        <Link
          href="/kitchen"
          className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg font-semibold"
        >
          👨‍🍳 厨房画面
        </Link>
      </div>

      <TablesClient initialTables={tables} />

      <DashboardNav current="/dashboard/tables" />
    </main>
  )
}
