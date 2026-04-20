export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? 'system@goat-groups.com'
const CRON_SECRET = process.env.CRON_SECRET ?? ''

async function sendOrderEmail(item: {
  name: string
  current_quantity: number
  min_quantity: number
  order_quantity: number
  unit: string
  supplier_email: string
}): Promise<boolean> {
  const subject = `【発注依頼】${item.name} - 人類みなまぜそば`
  const text = `お世話になっております。
人類みなまぜそばです。
以下の食材の発注をお願いいたします。

商品: ${item.name}
発注数量: ${item.order_quantity} ${item.unit}
現在庫: ${item.current_quantity}${item.unit}

よろしくお願いいたします。
人類みなまぜそば（GOATシステム自動送信）`

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: item.supplier_email }] }],
      from: { email: FROM_EMAIL, name: '人類みなまぜそば GOATシステム' },
      subject,
      content: [{ type: 'text/plain', value: text }],
    }),
  })

  return res.status >= 200 && res.status < 300
}

export async function GET(req: NextRequest) {
  // cron認証（secretが設定されている場合のみチェック）
  if (CRON_SECRET) {
    const secret = req.nextUrl.searchParams.get('secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 在庫不足 & supplier_email があるアイテムを検索
  const { data: items, error } = await db
    .from('inventory_items')
    .select('id, name, current_stock, min_stock, order_quantity, unit, supplier_email')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .not('supplier_email', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const lowItems = (items ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => i.current_stock <= i.min_stock && i.min_stock > 0 && i.supplier_email
  )

  const results: { name: string; success: boolean }[] = []

  for (const item of lowItems) {
    const orderQty = item.order_quantity ?? item.min_stock * 2
    const success = await sendOrderEmail({
      name: item.name,
      current_quantity: item.current_stock,
      min_quantity: item.min_stock,
      order_quantity: orderQty,
      unit: item.unit,
      supplier_email: item.supplier_email,
    })
    results.push({ name: item.name, success })

    // 発注ログをDBに記録
    await db.from('auto_order_logs').insert({
      tenant_id: TENANT_ID,
      item_id: item.id,
      item_name: item.name,
      order_quantity: orderQty,
      supplier_email: item.supplier_email,
      success,
      ordered_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    ok: true,
    checked: lowItems.length,
    results,
  })
}
