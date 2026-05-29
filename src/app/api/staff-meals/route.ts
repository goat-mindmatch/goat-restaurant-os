export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/staff-meals?month=YYYY-MM  → 月別合計 + 当日合計
 * POST /api/staff-meals                → スタッフ飯1件を記録
 *   body: { date, amount, staff_id?, note? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  const date  = searchParams.get('date')

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const firstDay = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const lastDay = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`

  const { data: rows } = await db
    .from('staff_meals')
    .select('id, date, amount, note, staff_id, staff:staff_id(name)')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false })

  const list = (rows ?? []) as Array<{
    id: string; date: string; amount: number; note: string | null
    staff_id: string | null
    staff: { name: string } | null
  }>

  const monthTotal = list.reduce((s, r) => s + r.amount, 0)
  const todayTotal = date
    ? list.filter(r => r.date === date).reduce((s, r) => s + r.amount, 0)
    : null

  return NextResponse.json({ rows: list, month_total: monthTotal, today_total: todayTotal })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const date     = String(body.date ?? '').trim()
    const amount   = Math.round(Number(body.amount))
    const staffId  = body.staff_id ?? null
    const note     = body.note ?? null

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'amount must be non-negative integer' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('staff_meals')
      .insert({
        tenant_id: TENANT_ID,
        date,
        amount,
        staff_id: staffId,
        note,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, meal: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
