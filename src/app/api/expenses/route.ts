export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/expenses?month=YYYY-MM  → 月次経費一覧
 * POST /api/expenses                → 手動経費登録
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const firstDay = month + '-01'
  const lastDay = month + '-31' // DB側で範囲内に収まる

  const { data: expenses } = await db.from('expenses')
    .select('*, staff:recorded_by(name)')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false })

  return NextResponse.json({ expenses: expenses ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, category, vendor, amount, note } = body

    if (!date || !amount) {
      return NextResponse.json({ error: 'date と amount は必須です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { data, error } = await db.from('expenses').insert({
      tenant_id: TENANT_ID,
      date,
      category: category ?? 'other',
      vendor: vendor ?? null,
      amount: Number(amount),
      note: note ?? null,
      ai_extracted: false,
    }).select().single()

    if (error) throw error

    return NextResponse.json({ ok: true, expense: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
