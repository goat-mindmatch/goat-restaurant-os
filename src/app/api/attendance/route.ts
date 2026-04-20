export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET   /api/attendance?date=YYYY-MM-DD  — 指定日の勤怠一覧
 * POST  /api/attendance                  — 手動打刻追加
 * PATCH /api/attendance                  — 打刻修正（clock_in/clock_out/break_minutes）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('attendance')
      .select('id, staff_id, date, clock_in, clock_out, break_minutes, work_minutes, recorded_via, staff:staff(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .order('clock_in', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { staff_id, date, clock_in, clock_out, break_minutes } = body

    if (!staff_id || !date) {
      return NextResponse.json({ error: 'staff_id と date は必須です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // UPSERT（同一スタッフ・同一日はユニーク制約）
    const { data, error } = await db
      .from('attendance')
      .upsert({
        tenant_id:     TENANT_ID,
        staff_id,
        date,
        clock_in:      clock_in      || null,
        clock_out:     clock_out     || null,
        break_minutes: Number(break_minutes) || 0,
        recorded_via:  'manual',
      }, { onConflict: 'staff_id,date' })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, id: data?.id }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, clock_in, clock_out, break_minutes } = body

    if (!id) return NextResponse.json({ error: 'id は必須です' }, { status: 400 })

    const update: Record<string, string | number | null> = { recorded_via: 'manual' }
    if (clock_in      !== undefined) update.clock_in      = clock_in      || null
    if (clock_out     !== undefined) update.clock_out     = clock_out     || null
    if (break_minutes !== undefined) update.break_minutes = Number(break_minutes) || 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('attendance')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
