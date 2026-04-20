export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import StaffPerformanceClient from './StaffPerformanceClient'

const TENANT_ID = process.env.TENANT_ID!

async function getData() {
  const db = createServiceClient() as any
  const now = new Date()
  const firstDay = now.toISOString().slice(0, 7) + '-01'
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`

  const [staffRes, attendanceRes, reviewsRes] = await Promise.all([
    db.from('staff')
      .select('id, name, role, hourly_wage')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
    db.from('attendance')
      .select('staff_id, date, work_minutes, clock_in, clock_out')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay),
    db.from('reviews')
      .select('staff_id, clicked_at, completed, verified_at')
      .eq('tenant_id', TENANT_ID)
      .gte('clicked_at', firstDay),
  ])

  const staffList = staffRes.data ?? []
  const attendance = attendanceRes.data ?? []
  const reviews = reviewsRes.data ?? []

  const perf = staffList.map((s: any) => {
    const myAtt = attendance.filter((a: any) => a.staff_id === s.id && a.work_minutes)
    const totalDays = myAtt.length
    const totalHours = myAtt.reduce((sum: number, a: any) => sum + (a.work_minutes ?? 0), 0) / 60
    const myReviews = reviews.filter((r: any) => r.staff_id === s.id)
    const reviewLeads = myReviews.length
    const reviewVerified = myReviews.filter((r: any) => r.verified_at).length
    const reviewBonus = reviewVerified * 100
    const score = Math.min(100, Math.round(
      (totalDays > 0 ? 40 : 0) +
      Math.min(30, totalHours * 2) +
      Math.min(30, reviewVerified * 10)
    ))
    return { staff: s, totalDays, totalHours, reviewLeads, reviewVerified, reviewBonus, score }
  }).sort((a: any, b: any) => b.score - a.score)

  return { perf, monthLabel }
}

export default async function StaffPerformancePage() {
  const { perf, monthLabel } = await getData()

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">スタッフ評価</h1>
        <p className="text-sm text-gray-500">{monthLabel}の実績</p>
      </div>
      <StaffPerformanceClient perf={perf} />
      <DashboardNav current="/dashboard/staff-performance" />
    </main>
  )
}
