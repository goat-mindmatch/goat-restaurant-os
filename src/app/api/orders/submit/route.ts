export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/submit
 * 発注依頼を保存
 * body: { supplier_id, items: [{name, quantity, unit, unit_price?}], delivery_date?, note?, lineUserId? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { supplier_id, items, delivery_date, note, lineUserId } = body
    if (!supplier_id || !items?.length) {
      return NextResponse.json({ error: 'supplier_id and items required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 業者情報取得
    const { data: supplier } = await db.from('suppliers')
      .select('name, contact_type, contact_value')
      .eq('id', supplier_id)
      .single()
    if (!supplier) {
      return NextResponse.json({ error: 'supplier not found' }, { status: 404 })
    }

    // 合計金額
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = items.reduce((sum: number, it: any) =>
      sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0)

    const { data: inserted, error } = await db.from('orders').insert({
      tenant_id: TENANT_ID,
      supplier_name: supplier.name,
      supplier_contact: supplier.contact_value,
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: delivery_date ?? null,
      items,
      total_amount: total > 0 ? total : null,
      status: 'draft',
      note: note ?? null,
    }).select('id').single()
    if (error) throw error

    // 依頼者へLINE通知（フォームURLから来た場合）
    if (lineUserId) {
      const itemList = items.map((it: { name: string; quantity: number; unit: string }) =>
        `・${it.name} ${it.quantity}${it.unit}`).join('\n')
      await sendLineMessage(lineUserId,
        `✅ 発注依頼を受け付けました！\n\n業者: ${supplier.name}\n配達希望日: ${delivery_date ?? '未指定'}\n\n【発注内容】\n${itemList}\n\n管理者が確認・送付します。`)
    }

    return NextResponse.json({ ok: true, order_id: inserted.id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
