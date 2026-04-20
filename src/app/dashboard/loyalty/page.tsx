export const dynamic = 'force-dynamic'

/**
 * お客様ロイヤルティ管理
 * LINE登録済みのお客様のポイント・来店回数・ランク管理
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import LoyaltyClient from './LoyaltyClient'

const TENANT_ID = process.env.TENANT_ID!

async function getData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const [customersRes, transactionsRes] = await Promise.all([
    db.from('customer_loyalty')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .order('points', { ascending: false }),
    db.from('loyalty_transactions')
      .select('*, customer:customer_id(display_name)')
      .eq('tenant_id', TENANT_ID)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const customers = customersRes.data ?? []
  const transactions = transactionsRes.data ?? []

  const totalCustomers = customers.length
  const totalPoints = customers.reduce((s: number, c: { points: number }) => s + (c.points ?? 0), 0)
  const avgVisits = totalCustomers > 0
    ? Math.round(customers.reduce((s: number, c: { visit_count: number }) => s + (c.visit_count ?? 0), 0) / totalCustomers * 10) / 10
    : 0

  return { customers, transactions, stats: { totalCustomers, totalPoints, avgVisits } }
}

export default async function LoyaltyPage() {
  const data = await getData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">お客様ロイヤルティ</h1>
        <p className="text-sm text-gray-500">LINE連携会員のポイント・来店管理</p>
      </div>

      <LoyaltyClient data={data} />

      <DashboardNav current="/dashboard/loyalty" />
    </main>
  )
}
