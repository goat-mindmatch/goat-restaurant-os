export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import MenuManagementClient from './MenuManagementClient'

const TENANT_ID = process.env.TENANT_ID!

async function getItems() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data } = await db
    .from('menu_items')
    .select('id, name, description, price, category, image_url, sort_order, is_available')
    .eq('tenant_id', TENANT_ID)
    .order('sort_order')
    .order('name')
  return data ?? []
}

export default async function MenuManagementPage() {
  const items = await getItems()
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">メニュー管理</h1>
        <p className="text-sm text-gray-500">商品の登録・写真・販売停止</p>
      </div>
      <MenuManagementClient initialItems={items} />
      <DashboardNav current="/dashboard/menu-management" />
    </main>
  )
}
