export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/shifts/finalize
 * 指定日のシフトを確定保存
 * body: { date, assignments: [{staff_id, start_time, end_time, role_on_day}] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { checkConstraints, type StaffInfo } from '@/lib/shift-constraints'

const TENANT_ID = process.env.TENANT_ID!

type Assignment = {
  staff_id: string
  start_time: string
  end_time: string
  role_on_day?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { date, assignments } = (await req.json()) as {
      date: string
      assignments: Assignment[]
    }
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 制約チェック
    const { data: staffData } = await db.from('staff')
      .select('id, name, skill_one_op, skill_kitchen, skill_open, skill_close')
      .eq('tenant_id', TENANT_ID).eq('is_active', true)
    const allStaff: StaffInfo[] = staffData ?? []
    const violations = checkConstraints(date, assignments, allStaff)
    const errors = violations.filter(v => v.type === 'error')
    const warnings = violations.filter(v => v.type === 'warning')

    // 一旦その日の既存シフトを全削除して入れ直す（シンプル方式）
    await db.from('shifts').delete().eq('tenant_id', TENANT_ID).eq('date', date)

    if (assignments.length > 0) {
      const rows = assignments.map(a => ({
        tenant_id: TENANT_ID,
        staff_id: a.staff_id,
        date,
        start_time: a.start_time,
        end_time: a.end_time,
        role_on_day: a.role_on_day ?? null,
      }))
      const { error } = await db.from('shifts').insert(rows)
      if (error) throw error
    }

    return NextResponse.json({
      ok: true, count: assignments.length,
      violations: violations.map(v => ({ type: v.type, message: v.message })),
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
