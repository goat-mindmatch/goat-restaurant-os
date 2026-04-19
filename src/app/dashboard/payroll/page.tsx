export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import PayrollPageClient from './PayrollPageClient'

const TENANT_ID = process.env.TENANT_ID!

async function getPayrollData(year: number, month: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10)

  const [staffRes, attRes, reviewsRes] = await Promise.all([
    db.from('staff').select('id, name, hourly_wage, transport_fee')
      .eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    db.from('attendance').select('staff_id, date, clock_in, clock_out, work_minutes, break_minutes')
      .eq('tenant_id', TENANT_ID).gte('date', firstDay).lte('date', lastDay),
    db.from('reviews').select('staff_id')
      .eq('tenant_id', TENANT_ID)
      .not('verified_at', 'is', null)
      .gte('clicked_at', firstDay)
      .lte('clicked_at', lastDay + 'T23:59:59'),
  ])

  const reviewCountMap: Record<string, number> = {}
  for (const r of reviewsRes.data ?? []) {
    if (r.staff_id) reviewCountMap[r.staff_id] = (reviewCountMap[r.staff_id] ?? 0) + 1
  }

  return {
    staffList: staffRes.data ?? [],
    attendance: attRes.data ?? [],
    reviewCountMap,
  }
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year  = Number(params.year)  || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1

  const { staffList, attendance, reviewCountMap } = await getPayrollData(year, month)

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">給与計算</h1>
        <p className="text-sm text-gray-500">{year}年{month}月の勤務時間・給与集計</p>
      </div>

      <PayrollPageClient
        staffList={staffList}
        attendance={attendance}
        reviewCountMap={reviewCountMap}
        month={month}
        year={year}
      />

      <DashboardNav current="/dashboard/payroll" />
    </main>
  )
}
