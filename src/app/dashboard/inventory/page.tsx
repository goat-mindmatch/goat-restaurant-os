export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import InventoryClient from './InventoryClient'
import DashboardNav from '@/components/DashboardNav'

const TENANT_ID = process.env.TENANT_ID!

async function getData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const [itemsRes, suppliersRes] = await Promise.all([
    db.from('inventory_items')
      .select('*, supplier:suppliers(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('category').order('name'),
    db.from('suppliers')
      .select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
  ])
  return { items: itemsRes.data ?? [], suppliers: suppliersRes.data ?? [] }
}

export default async function InventoryPage() {
  const { items, suppliers } = await getData()

  const lowStock = items.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => i.current_stock <= i.min_stock && i.min_stock > 0
  )

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">在庫管理</h1>
          <p className="text-sm text-gray-500">
            {items.length}品目
            {lowStock.length > 0 && (
              <span className="ml-2 text-red-500 font-semibold">⚠️ 要発注 {lowStock.length}件</span>
            )}
          </p>
        </div>
      </div>

      <InventoryClient items={items} suppliers={suppliers} />
      <DashboardNav current="/dashboard/inventory" />
    </main>
  )
}
