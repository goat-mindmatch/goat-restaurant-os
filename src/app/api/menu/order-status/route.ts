export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/menu/order-status
 * 注文ステータスを更新（厨房操作）
 * body: { order_id, status }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

const VALID_STATUS = ['confirmed', 'cooking', 'ready', 'served', 'cancelled']

export async function POST(req: NextRequest) {
  try {
    const { order_id, status } = await req.json()

    if (!order_id || !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: '無効なリクエストです' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { error } = await db.from('customer_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order_id)
      .eq('tenant_id', TENANT_ID)

    if (error) throw error

    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
