export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/manual
 * 1日分の売上を手動登録
 * body: { date, store_sales, delivery_sales, store_orders, delivery_orders, food_cost? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, store_sales, delivery_sales, store_orders, delivery_orders, food_cost } = body

    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { error } = await db.from('daily_sales').upsert({
      tenant_id: TENANT_ID,
      date,
      store_sales: Number(store_sales) || 0,
      delivery_sales: Number(delivery_sales) || 0,
      store_orders: Number(store_orders) || 0,
      delivery_orders: Number(delivery_orders) || 0,
      food_cost: food_cost !== undefined ? Number(food_cost) : null,
      data_source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,date' })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
