export const dynamic = 'force-dynamic'

/**
 * レシートギャラリー
 * - スタッフ別送付枚数ランキング
 * - 画像サムネイル一覧（タップで拡大）
 * - カテゴリ・スタッフでフィルタ可能
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import ReceiptsClient from './ReceiptsClient'
import Link from 'next/link'

const TENANT_ID = process.env.TENANT_ID!

async function getReceiptsData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const firstDay = month + '-01'
  const lastDay = now.toISOString().split('T')[0]

  const { data: expenses } = await db
    .from('expenses')
    .select('*, staff:recorded_by(id, name)')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false })

  const rows = (expenses ?? []) as Array<{
    id: string
    date: string
    category: string
    vendor: string | null
    amount: number
    note: string | null
    receipt_url: string | null
    ai_extracted: boolean
    staff: { id: string; name: string } | null
  }>

  // スタッフ別集計
  const staffMap = new Map<string, { id: string; name: string; count: number; total: number }>()
  for (const exp of rows) {
    if (!exp.staff) continue
    const key = exp.staff.id
    if (!staffMap.has(key)) {
      staffMap.set(key, { id: exp.staff.id, name: exp.staff.name, count: 0, total: 0 })
    }
    const s = staffMap.get(key)!
    s.count++
    s.total += exp.amount
  }
  const staffStats = Array.from(staffMap.values()).sort((a, b) => b.count - a.count)

  return { expenses: rows, staffStats, month }
}


export default async function ReceiptsPage() {
  const { expenses, staffStats, month } = await getReceiptsData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard/pl" className="text-gray-400 hover:text-gray-600">
          ← PL
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">レシートフォルダ</h1>
          <p className="text-sm text-gray-500">{month} · {expenses.length}件</p>
        </div>
      </div>

      <ReceiptsClient expenses={expenses} staffStats={staffStats} month={month} />

      <DashboardNav current="/dashboard/receipts" />
    </main>
  )
}
