export const dynamic = 'force-dynamic'

/**
 * レシートギャラリー
 * - URL: /dashboard/receipts?month=YYYY-MM （省略時は今月）
 * - スタッフ別送付枚数ランキング
 * - 画像サムネイル一覧（タップで拡大・編集）
 * - カテゴリ・スタッフでフィルタ
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import ReceiptsClient from './ReceiptsClient'
import Link from 'next/link'

const TENANT_ID = process.env.TENANT_ID!

type RawExpense = {
  id: string
  date: string
  category: string
  vendor: string | null
  amount: number
  note: string | null
  receipt_url: string | null
  ai_extracted: boolean
  staff: { id: string; name: string } | null
}

function isValidMonth(s: string | null | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s)
}

function monthRange(month: string): { firstDay: string; lastDay: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    firstDay: `${month}-01`,
    lastDay: `${month}-${String(last).padStart(2, '0')}`,
  }
}

async function getReceiptsData(month: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { firstDay, lastDay } = monthRange(month)

  const { data: expenses } = await db
    .from('expenses')
    .select('*, staff:recorded_by(id, name)')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false })

  const rows = (expenses ?? []) as RawExpense[]

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

  return { expenses: rows, staffStats }
}

function buildMonthOptions(currentMonth: string): string[] {
  const result: string[] = []
  const [y, m] = currentMonth.split('-').map(Number)
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

type PageProps = {
  searchParams: Promise<{ month?: string }>
}

export default async function ReceiptsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const today = new Date().toISOString().slice(0, 7)
  const month = isValidMonth(sp.month) ? sp.month : today
  const monthOptions = buildMonthOptions(today)

  const { expenses, staffStats } = await getReceiptsData(month)

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard/pl" className="text-gray-400 hover:text-gray-600">
          ← PL
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">レシートフォルダ</h1>
          <p className="text-sm text-gray-500">{month} · {expenses.length}件</p>
        </div>
      </div>

      <ReceiptsClient
        expenses={expenses}
        staffStats={staffStats}
        month={month}
        monthOptions={monthOptions}
      />

      <DashboardNav current="/dashboard/receipts" />
    </main>
  )
}
