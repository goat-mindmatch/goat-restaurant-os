export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import PayrollClient from './PayrollClient'

const TENANT_ID = process.env.TENANT_ID!

async function getPayrollData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const now = new Date()
  const firstDay = now.toISOString().slice(0, 7) + '-01'
  const lastDay = now.toISOString().slice(0, 10)

  const [staffRes, attRes, reviewsRes] = await Promise.all([
    db.from('staff').select('id, name, hourly_wage, transport_fee')
      .eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    db.from('attendance').select('staff_id, date, clock_in, clock_out, work_minutes, break_minutes')
      .eq('tenant_id', TENANT_ID).gte('date', firstDay).lte('date', lastDay),
    db.from('reviews').select('staff_id')
      .eq('tenant_id', TENANT_ID)
      .not('verified_at', 'is', null)
      .gte('clicked_at', firstDay)
      .lte('clicked_at', lastDay),
  ])

  const staffList = staffRes.data ?? []
  const attendance = attRes.data ?? []
  const verifiedReviews = reviewsRes.data ?? []

  // スタッフ別の口コミ件数
  const reviewCountMap: Record<string, number> = {}
  for (const r of verifiedReviews) {
    if (r.staff_id) reviewCountMap[r.staff_id] = (reviewCountMap[r.staff_id] ?? 0) + 1
  }

  return { staffList, attendance, reviewCountMap, month: now.getMonth() + 1 }
}

export default async function PayrollPage() {
  const { staffList, attendance, reviewCountMap, month } = await getPayrollData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">給与計算</h1>
        <p className="text-sm text-gray-500">{month}月の勤務時間・給与集計</p>
      </div>

      <PayrollClient staffList={staffList} attendance={attendance} reviewCountMap={reviewCountMap} month={month} />

      <DashboardNav current="/dashboard/payroll" />
    </main>
  )
}
