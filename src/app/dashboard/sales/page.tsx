export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import SalesClient from './SalesClient'

const TENANT_ID = process.env.TENANT_ID!

async function getSalesData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // JST（日本時間）で今日を計算（UTC + 9時間）
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const firstDay = nowJST.toISOString().slice(0, 7) + '-01'
  const lastDay = nowJST.toISOString().slice(0, 10)

  const { data: sales } = await db.from('daily_sales')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false })

  return { sales: sales ?? [] }
}

export default async function SalesPage() {
  const { sales } = await getSalesData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">売上管理</h1>
        <p className="text-sm text-gray-500">AnyDeli Excelアップロード / 手動入力</p>
      </div>

      <SalesClient initialSales={sales} />

      <DashboardNav current="/dashboard/sales" />
    </main>
  )
}
