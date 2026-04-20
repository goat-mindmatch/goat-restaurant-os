'use client'

import { useRouter } from 'next/navigation'
import ShiftsClient from './ShiftsClient'

type StaffRow = { id: string; name: string }

type Props = {
  year: number
  month: number
  lastDay: number
  staffList: StaffRow[]
  requestMap: Record<number, string[]>
  shiftMap: Record<number, string[]>
  notSubmitted: StaffRow[]
}

export default function ShiftsPageClient(props: Props) {
  const router = useRouter()

  const handleMonthChange = (y: number, m: number) => {
    router.push(`/dashboard/shifts?year=${y}&month=${m}`)
  }

  return <ShiftsClient {...props} onMonthChange={handleMonthChange} />
}
