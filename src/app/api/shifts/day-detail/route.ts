export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/shifts/day-detail?date=2026-05-03
 * 指定日のシフト希望提出者 + 既存の確定シフトを返す
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const [year, month] = date.split('-').map(Number)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const [staffRes, requestsRes, shiftsRes] = await Promise.all([
    db.from('staff')
      .select('id, name, skill_hall, skill_cashier, skill_kitchen, skill_one_op')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
    db.from('shift_requests')
      .select('staff_id, available_dates')
      .eq('tenant_id', TENANT_ID)
      .eq('target_year', year)
      .eq('target_month', month),
    db.from('shifts')
      .select('staff_id, start_time, end_time, role_on_day, note')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date),
  ])

  const allStaff = staffRes.data ?? []
  const requests = requestsRes.data ?? []
  const existingShifts = shiftsRes.data ?? []

  // この日を希望提出したスタッフID集合
  const submittedIds = new Set<string>()
  for (const r of requests) {
    if ((r.available_dates as string[]).includes(date)) {
      submittedIds.add(r.staff_id)
    }
  }

  // 既存確定シフトのマップ
  const existingMap = new Map<string, { start_time: string; end_time: string; role_on_day: string | null }>()
  for (const s of existingShifts) {
    existingMap.set(s.staff_id, {
      start_time: s.start_time,
      end_time: s.end_time,
      role_on_day: s.role_on_day,
    })
  }

  // スタッフごとに「希望あり / 確定済み / どちらでもない」を付与
  const staffWithState = allStaff.map((s: { id: string; name: string; skill_hall: boolean; skill_cashier: boolean; skill_kitchen: boolean; skill_one_op: boolean }) => ({
    id: s.id,
    name: s.name,
    skills: {
      hall: s.skill_hall,
      cashier: s.skill_cashier,
      kitchen: s.skill_kitchen,
      oneOp: s.skill_one_op,
    },
    submitted: submittedIds.has(s.id),
    confirmed: existingMap.get(s.id) ?? null,
  }))

  return NextResponse.json({
    date,
    staff: staffWithState,
  })
}
