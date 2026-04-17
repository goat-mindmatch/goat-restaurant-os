export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {[
            { label: 'ホーム', href: '/dashboard', icon: '🏠' },
            { label: 'シフト', href: '/dashboard/shifts', icon: '📅' },
            { label: '発注', href: '/dashboard/orders', icon: '📦' },
            { label: 'PL', href: '/dashboard/pl', icon: '📋' },
            { label: '給与', href: '/dashboard/payroll', icon: '💴' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="flex flex-col items-center py-1 text-xs text-gray-500 hover:text-gray-900">
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  )
}
