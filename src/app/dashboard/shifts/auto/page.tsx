export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import ShiftAutoClient from './ShiftAutoClient'
import Link from 'next/link'

const TENANT_ID = process.env.TENANT_ID!

export default async function ShiftAutoPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const year  = Number(params.year)  || nextMonth.getFullYear()
  const month = Number(params.month) || nextMonth.getMonth() + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: staffData } = await db
    .from('staff')
    .select('id, name, max_days_per_week')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('name')

  const staff = staffData ?? []

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <Link href="/dashboard/shifts" className="text-gray-400 text-sm">← 戻る</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AIシフト自動作成</h1>
          <p className="text-sm text-gray-500">{year}年{month}月</p>
        </div>
      </div>

      {/* 年月切替 */}
      <div className="mx-4 mt-3 flex gap-2">
        {[-1, 0, 1].map(offset => {
          const d = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
          const y = d.getFullYear()
          const m = d.getMonth() + 1
          const isActive = y === year && m === month
          return (
            <a
              key={offset}
              href={`/dashboard/shifts/auto?year=${y}&month=${m}`}
              className={`flex-1 py-2 text-center rounded-xl text-sm font-semibold border ${
                isActive
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {y}/{m}月
            </a>
          )
        })}
      </div>

      <ShiftAutoClient year={year} month={month} staff={staff} />

      <DashboardNav current="/dashboard/shifts" />
    </main>
  )
}
