export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/send
 * 指定の発注をフォーマット済みテキストで返す（業者に送る用）
 * body: { order_id }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { data: order } = await db.from('orders')
      .select('*').eq('id', order_id).eq('tenant_id', TENANT_ID).single()
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const { data: tenant } = await db.from('tenants')
      .select('name').eq('id', TENANT_ID).single()

    const items = order.items as { name: string; quantity: number; unit: string; unit_price?: number }[]
    const itemList = items.map(it => {
      const price = it.unit_price ? `（@¥${it.unit_price.toLocaleString()}）` : ''
      return `・${it.name}　${it.quantity}${it.unit}${price}`
    }).join('\n')

    const delivery = order.delivery_date
      ? `\n配達希望日: ${order.delivery_date}`
      : ''

    const total = order.total_amount
      ? `\n\n合計: ¥${order.total_amount.toLocaleString()}`
      : ''

    const noteText = order.note ? `\n\n備考: ${order.note}` : ''

    const message = `【発注のお願い】
${tenant?.name ?? '当店'}より、下記の通り発注させていただきます。

━━━━━━━━━━━━━━
${itemList}
━━━━━━━━━━━━━━${delivery}${total}${noteText}

お手数ですが、ご確認のほどよろしくお願いいたします。`

    // 状態を sent に更新
    await db.from('orders').update({
      status: 'sent',
      sent_via: order.supplier_contact ? 'line' : null,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    return NextResponse.json({
      ok: true,
      message,
      supplier: {
        name: order.supplier_name,
        contact_type: order.supplier_contact ? 'line' : null,
        contact: order.supplier_contact,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
