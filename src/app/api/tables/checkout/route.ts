export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/tables/checkout
 * テーブルの会計完了処理
 * body: { table_number, payment_method }
 *
 * - そのテーブルの全アクティブ注文を "served" に更新
 * - 合計金額を返す（売上手入力の参考値として使える）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { table_number, payment_method } = await req.json()

    if (table_number === undefined) {
      return NextResponse.json({ error: 'table_number required' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    // 対象注文を取得
    const { data: orders, error: fetchErr } = await db
      .from('customer_orders')
      .select('id, total_amount, items')
      .eq('tenant_id', TENANT_ID)
      .eq('table_number', Number(table_number))
      .in('status', ['pending', 'confirmed', 'cooking', 'ready', 'waiting_payment'])
      .gte('created_at', today + 'T00:00:00')

    if (fetchErr) throw fetchErr

    if (!orders?.length) {
      return NextResponse.json({ ok: true, total_amount: 0, order_count: 0 })
    }

    const total = orders.reduce(
      (s: number, o: { total_amount: number }) => s + o.total_amount, 0
    )
    const ids = orders.map((o: { id: string }) => o.id)

    // 全注文を served に更新
    const { error: updateErr } = await db
      .from('customer_orders')
      .update({
        status: 'served',
        payment_method: payment_method || 'cash',
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('tenant_id', TENANT_ID)

    if (updateErr) throw updateErr

    return NextResponse.json({
      ok: true,
      total_amount: total,
      order_count: orders.length,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
