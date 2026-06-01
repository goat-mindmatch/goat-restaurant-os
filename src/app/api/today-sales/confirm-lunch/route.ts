export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/today-sales/confirm-lunch
 *   body: { date: 'YYYY-MM-DD' }
 *   昼営業終了時、その時点の total_sales を lunch_sales としてスナップショット。
 *   夜売上は total - lunch でダッシュボード側が算出する。
 *   再実行で「昼を取り直す」ことも可能（最新の total で上書き）。
 *
 * DELETE /api/today-sales/confirm-lunch?date=YYYY-MM-DD
 *   昼確定を取り消す（lunch_sales=0, lunch_confirmed_at=null）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const date = String(body.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 現在の総売上を取得（GENERATEDカラム）
    const { data: row } = await db
      .from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .maybeSingle()

    const total = Number(row?.total_sales ?? 0)

    const { error } = await db
      .from('daily_sales')
      .upsert(
        {
          tenant_id: TENANT_ID,
          date,
          lunch_sales: total,
          lunch_confirmed_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,date', ignoreDuplicates: false }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, lunch_sales: total })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('daily_sales')
      .update({ lunch_sales: 0, lunch_confirmed_at: null })
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
