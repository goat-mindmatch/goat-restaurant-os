'use client'

import { useRouter } from 'next/navigation'
import PayrollClient from './PayrollClient'

type Staff = { id: string; name: string; hourly_wage: number; transport_fee: number | null }
type Attendance = {
  staff_id: string; date: string; clock_in: string | null; clock_out: string | null
  work_minutes: number | null; break_minutes: number
}

export default function PayrollPageClient({
  staffList, attendance, reviewCountMap, month, year,
}: {
  staffList: Staff[]
  attendance: Attendance[]
  reviewCountMap: Record<string, number>
  month: number
  year: number
}) {
  const router = useRouter()

  const handleMonthChange = (y: number, m: number) => {
    router.push(`/dashboard/payroll?year=${y}&month=${m}`)
  }

  return (
    <PayrollClient
      staffList={staffList}
      attendance={attendance}
      reviewCountMap={reviewCountMap}
      month={month}
      year={year}
      onMonthChange={handleMonthChange}
    />
  )
}
