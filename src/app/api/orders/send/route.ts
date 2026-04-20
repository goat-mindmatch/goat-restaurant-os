export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/send
 * 発注メッセージ生成 + 業者への自動送信（LINE or メール）
 * body: { order_id }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL ?? ''

/** SendGrid REST API 経由でメール送信 */
async function sendEmail(
  to: string, subject: string, text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    return { ok: false, error: 'SENDGRID_API_KEY が Vercel 環境変数に未設定' }
  }
  if (!FROM_EMAIL) {
    return { ok: false, error: 'FROM_EMAIL が Vercel 環境変数に未設定' }
  }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    })
    if (res.status === 202) return { ok: true }
    const detail = await res.text()
    return { ok: false, error: `SendGrid ${res.status}: ${detail}` }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** 発注メッセージ本文を生成（ビジネス文書形式） */
function buildOrderMessage(
  tenantName: string,
  supplierName: string,
  items: { name: string; quantity: number; unit: string; unit_price?: number }[],
  deliveryDate: string | null,
  totalAmount: number | null,
  note: string | null,
): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })

  const itemList = items.map(it => {
    const price = it.unit_price ? `　（@¥${it.unit_price.toLocaleString()}）` : ''
    return `　・${it.name}　${it.quantity}${it.unit}${price}`
  }).join('\n')

  const deliveryLine = deliveryDate
    ? `\n配達希望日：${deliveryDate.replace(/-/g, '年').replace(/-/, '月') + '日'}\n`
    : ''
  const totalLine = totalAmount
    ? `\nご請求合計：¥${totalAmount.toLocaleString()}（税込）\n`
    : ''
  const noteLine = note ? `\n【備考】\n${note}\n` : ''

  return `${supplierName} 御中

お世話になっております。
${tenantName}でございます。

下記の通り、発注をお願いできますでしょうか。
お手数をおかけいたしますが、ご確認・ご手配のほどよろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━
【発注内容】
${itemList}
━━━━━━━━━━━━━━━━━━━━
${deliveryLine}${totalLine}${noteLine}
発注日：${dateStr}

以上、どうぞよろしくお願いいたします。

──────────────────────
${tenantName}
──────────────────────`
}

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

    const tenantName = tenant?.name ?? '人類みなまぜそば'
    const items = order.items as { name: string; quantity: number; unit: string; unit_price?: number }[]
    const message = buildOrderMessage(
      tenantName,
      order.supplier_name,
      items,
      order.delivery_date ?? null,
      order.total_amount ?? null,
      order.note ?? null,
    )

    // 業者情報取得（email + contact_method）
    let supplierEmail: string | null = null
    let contactMethod = 'line'
    if (order.supplier_id) {
      const { data: supplier } = await db.from('suppliers')
        .select('email, contact_method').eq('id', order.supplier_id).single()
      supplierEmail = supplier?.email ?? null
      contactMethod = supplier?.contact_method ?? 'line'
    }

    let emailSent = false
    let emailError: string | null = null
    let lineSent = false

    // メール送信（email or both）
    if (supplierEmail && (contactMethod === 'email' || contactMethod === 'both')) {
      const subject = `【発注】${order.supplier_name} 宛 — ${new Date().toLocaleDateString('ja-JP')}`
      const result = await sendEmail(supplierEmail, subject, message)
      emailSent = result.ok
      emailError = result.error ?? null
    }

    // 管理者にLINE通知（常に実施）
    try {
      const { sendLineMessage } = await import('@/lib/line-staff')
      const { data: managers } = await db.from('staff')
        .select('line_user_id').eq('tenant_id', TENANT_ID).eq('role', 'manager')
        .eq('is_active', true).not('line_user_id', 'is', null)

      const sentInfo = emailSent ? '📧 業者にメール送信済み' : '⚠️ 業者LINEに貼り付けてください'
      for (const m of managers ?? []) {
        await sendLineMessage(
          m.line_user_id,
          `📦 発注送付完了\n業者: ${order.supplier_name}\n品目: ${items.length}品\n${sentInfo}`
        ).catch(() => {})
      }
      lineSent = true
    } catch {}

    // ステータスを sent に更新
    await db.from('orders').update({
      status: 'sent',
      sent_via: emailSent ? 'email' : lineSent ? 'line' : null,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    return NextResponse.json({
      ok: true,
      message,
      email_sent: emailSent,
      email_error: emailError,
      line_notified: lineSent,
      supplier: {
        name: order.supplier_name,
        email: supplierEmail,
        contact_method: contactMethod,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
