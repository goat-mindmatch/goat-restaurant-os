export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? ''
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? 'system@goat-groups.com'
const CRON_SECRET = process.env.CRON_SECRET ?? ''

async function sendOrderEmail(item: {
  name: string
  current_quantity: number
  min_quantity: number
  order_quantity: number
  unit: string
  supplier_email: string
  supplier_name: string
}): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false

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
  // cron認証
  if (CRON_SECRET) {
    const secret = req.nextUrl.searchParams.get('secret')
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // inventory_items を取得（suppliers テーブルをJOINしてメールアドレスを取得）
  const { data: items, error } = await db
    .from('inventory_items')
    .select('id, name, current_stock, min_stock, unit, supplier:suppliers(id, name, email)')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 在庫が基準値以下かつサプライヤーのメールがあるものだけ対象
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lowItems = (items ?? []).filter((i: any) =>
    i.current_stock <= i.min_stock &&
    i.min_stock > 0 &&
    i.supplier?.email
  )

  // サプライヤーメールがない場合でも在庫不足リストは返す
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLowItems = (items ?? []).filter((i: any) =>
    i.current_stock <= i.min_stock && i.min_stock > 0
  )

  if (allLowItems.length === 0) {
    return NextResponse.json({
      ok: true,
      message: '在庫不足の食材はありません ✅',
      checked: (items ?? []).length,
      lowItems: 0,
      results: [],
    })
  }

  if (lowItems.length === 0) {
    // 在庫不足はあるがメール未設定
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = allLowItems.map((i: any) => i.name).join('、')
    return NextResponse.json({
      ok: true,
      message: `⚠️ 在庫不足: ${names}（サプライヤーのメールアドレスが未設定のため自動送信なし）`,
      checked: (items ?? []).length,
      lowItems: allLowItems.length,
      results: [],
    })
  }

  const results: { name: string; success: boolean; email: string }[] = []

  for (const item of lowItems) {
    const orderQty = item.min_stock * 2
    const supplierEmail = item.supplier?.email ?? ''
    const supplierName  = item.supplier?.name  ?? '不明'

    const success = await sendOrderEmail({
      name: item.name,
      current_quantity: item.current_stock,
      min_quantity: item.min_stock,
      order_quantity: orderQty,
      unit: item.unit,
      supplier_email: supplierEmail,
      supplier_name: supplierName,
    })
    results.push({ name: item.name, success, email: supplierEmail })

    // 発注ログ記録（auto_order_logs テーブルが存在する場合のみ）
    await db.from('auto_order_logs').insert({
      tenant_id:      TENANT_ID,
      item_id:        item.id,
      item_name:      item.name,
      order_quantity: orderQty,
      supplier_email: supplierEmail,
      success,
      ordered_at:     new Date().toISOString(),
    }).catch(() => {/* テーブルなければスキップ */})
  }

  const sentCount = results.filter(r => r.success).length
  return NextResponse.json({
    ok: true,
    message: `📦 ${sentCount}件の発注メールを送信しました`,
    checked: (items ?? []).length,
    lowItems: lowItems.length,
    results,
  })
}
