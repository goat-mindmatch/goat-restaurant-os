export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/menu/sort
 * メニュー商品の表示順を一括更新
 * body: { orders: [{ id: string, sort_order: number }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { orders } = await req.json() as { orders: { id: string; sort_order: number }[] }
    if (!orders?.length) return NextResponse.json({ error: 'orders required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 並列更新
    await Promise.all(
      orders.map(({ id, sort_order }) =>
        db.from('menu_items')
          .update({ sort_order })
          .eq('id', id)
          .eq('tenant_id', TENANT_ID)
      )
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
