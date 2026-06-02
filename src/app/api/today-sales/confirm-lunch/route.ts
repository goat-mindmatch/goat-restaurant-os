export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/today-sales/confirm-lunch
 *   body: { date: 'YYYY-MM-DD', uber_lunch?: number, rocketnow_lunch?: number }
 *   昼営業終了（15時）時に、昼売上を確定する。
 *     lunch_sales = 店頭昼(その時点の store_sales) + Uber昼 + RocketNow昼
 *   夜売上は ダッシュボードが total - lunch で算出する。
 *   ※ store_sales は 15:00 の AnyDeli 同期で「昼までの店頭合計」が入っている前提。
 *      Uber/RocketNow の昼分はこのAPIで受け取って合算・保持する。
 *   再実行で「昼を取り直す」ことも可能（最新値で上書き）。
 *
 * DELETE /api/today-sales/confirm-lunch?date=YYYY-MM-DD
 *   昼確定を取り消す（lunch_sales=0, 昼分=0, lunch_confirmed_at=null）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

function num(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const date = String(body.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const uberLunch   = num(body.uber_lunch)
    const rocketLunch = num(body.rocketnow_lunch)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 店頭昼を取得。15時同期で固定した store_lunch_sales を優先（時刻依存バグ回避）。
    // 未取得なら store_sales にフォールバック。
    const { data: row } = await db
      .from('daily_sales')
      .select('store_sales, store_lunch_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .maybeSingle()

    const storeLunch = row?.store_lunch_sales != null
      ? Number(row.store_lunch_sales)
      : Number(row?.store_sales ?? 0)
    const lunchSales = storeLunch + uberLunch + rocketLunch

    const { error } = await db
      .from('daily_sales')
      .upsert(
        {
          tenant_id: TENANT_ID,
          date,
          lunch_sales: lunchSales,
          uber_lunch_sales: uberLunch,
          rocketnow_lunch_sales: rocketLunch,
          lunch_confirmed_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,date', ignoreDuplicates: false }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      ok: true,
      lunch_sales: lunchSales,
      breakdown: { store: storeLunch, uber: uberLunch, rocketnow: rocketLunch },
    })
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
      .update({
        lunch_sales: 0,
        uber_lunch_sales: 0,
        rocketnow_lunch_sales: 0,
        lunch_confirmed_at: null,
      })
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
