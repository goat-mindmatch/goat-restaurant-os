export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/menu/order
 * お客様が注文を確定する
 * body: { table_number, items: [{id, name, price, quantity}], payment_method, note? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!

type OrderItem = {
  id: string
  name: string
  price: number
  quantity: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table_number, items, payment_method, note } = body as {
      table_number: number
      items: OrderItem[]
      payment_method: 'cash' | 'paypay'
      note?: string
    }

    if (!table_number || !items?.length) {
      return NextResponse.json({ error: 'テーブル番号と注文内容は必須です' }, { status: 400 })
    }

    const total_amount = items.reduce((s, it) => s + it.price * it.quantity, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 注文を保存
    const { data: order, error } = await db.from('customer_orders').insert({
      tenant_id: TENANT_ID,
      table_number,
      items,
      total_amount,
      payment_method,
      note: note ?? null,
      status: 'pending',
    }).select().single()

    if (error) throw error

    // 厨房（管理者）にLINE通知
    try {
      const { data: managers } = await db.from('staff')
        .select('line_user_id, name')
        .eq('tenant_id', TENANT_ID)
        .eq('role', 'manager')
        .not('line_user_id', 'is', null)

      const PAYMENT_LABELS: Record<string, string> = {
        cash: '現金（レジ払い）',
        paypay: 'PayPay',
        line_pay: 'LINE Pay',
        card: 'クレカ',
      }

      const itemLines = items
        .map(it => `・${it.name} × ${it.quantity}　¥${(it.price * it.quantity).toLocaleString()}`)
        .join('\n')

      const message =
        `🍜 新規注文が入りました！\n\n` +
        `🪑 テーブル: ${table_number}番\n` +
        `💴 合計: ¥${total_amount.toLocaleString()}\n` +
        `💳 支払: ${PAYMENT_LABELS[payment_method] ?? payment_method}\n\n` +
        `${itemLines}` +
        (note ? `\n\n📝 ${note}` : '') +
        `\n\n🕐 ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`

      for (const m of managers ?? []) {
        await sendLineMessage(m.line_user_id, message).catch(() => {})
      }

      // 通知時刻を記録
      await db.from('customer_orders')
        .update({ notified_at: new Date().toISOString(), status: 'confirmed' })
        .eq('id', order.id)
    } catch {
      // 通知失敗しても注文自体は成功
    }

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      total_amount,
      payment_method,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
