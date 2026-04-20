export const dynamic = 'force-dynamic'

/**
 * シフト管理ページ（確定編集可能）
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import ShiftsPageClient from './ShiftsPageClient'
import AttendanceClient from './AttendanceClient'

const TENANT_ID = process.env.TENANT_ID!

type StaffRow = { id: string; name: string }

async function getShiftData(year: number, month: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDayNum = new Date(year, month, 0).getDate()
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`

  const [staffRes, requestsRes, shiftsRes] = await Promise.all([
    db.from('staff').select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
    db.from('shift_requests')
      .select('staff_id, available_dates')
      .eq('tenant_id', TENANT_ID)
      .eq('target_year', year)
      .eq('target_month', month),
    db.from('shifts')
      .select('staff_id, date')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay),
  ])

  const staffList: StaffRow[] = staffRes.data ?? []
  const requests: { staff_id: string; available_dates: string[] }[] = requestsRes.data ?? []
  const shifts: { staff_id: string; date: string }[] = shiftsRes.data ?? []

  // 希望マップ（日 → staff_id[]）
  const requestMap: Record<number, string[]> = {}
  for (const req of requests) {
    for (const d of req.available_dates) {
      const day = parseInt(d.split('-')[2])
      if (!requestMap[day]) requestMap[day] = []
      requestMap[day].push(req.staff_id)
    }
  }

  // 確定マップ（日 → staff_id[]）
  const shiftMap: Record<number, string[]> = {}
  for (const s of shifts) {
    const day = parseInt(s.date.split('-')[2])
    if (!shiftMap[day]) shiftMap[day] = []
    shiftMap[day].push(s.staff_id)
  }

  const submittedIds = new Set(requests.map(r => r.staff_id))
  const notSubmitted = staffList.filter(s => !submittedIds.has(s.id))

  return { staffList, requestMap, shiftMap, notSubmitted, lastDay: lastDayNum }
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const year  = Number(params.year)  || nextMonth.getFullYear()
  const month = Number(params.month) || nextMonth.getMonth() + 1

  const data = await getShiftData(year, month)

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">シフト管理</h1>
        <p className="text-sm text-gray-500">{year}年{month}月</p>
      </div>

      <ShiftsPageClient
        year={year}
        month={month}
        lastDay={data.lastDay}
        staffList={data.staffList}
        requestMap={data.requestMap}
        shiftMap={data.shiftMap}
        notSubmitted={data.notSubmitted}
      />

      {/* 勤怠手動修正（打刻忘れ対応） */}
      <AttendanceClient staffList={data.staffList} />

      <DashboardNav current="/dashboard/shifts" />
    </main>
  )
}
