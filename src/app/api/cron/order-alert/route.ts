export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/order-alert
 * Vercel Cronから毎日13:00 JST（04:00 UTC）に呼ばれる
 * - status='sent' かつ 送信から4時間以上経過した発注を検出
 * - 管理者LINEに「業者から返信がありません」とアラート送信
 * - alert_sent_at フラグで二重送信を防止
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // Vercel Cron の認証
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    // 4時間前のタイムスタンプ（毎日13時JSTに実行 → 朝9時以前に送った発注を対象）
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 4時間以上前に送信 & まだ delivered/cancelled になっておらず & アラート未送信
    const { data: overdueOrders } = await db
      .from('orders')
      .select('id, supplier_name, items, total_amount, delivery_date, note, updated_at')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'sent')
      .lt('updated_at', fourHoursAgo)
      .is('alert_sent_at', null)

    if (!overdueOrders || overdueOrders.length === 0) {
      return NextResponse.json({ ok: true, alerted: 0, message: '未確認発注なし' })
    }

    // 管理者を取得
    const { data: managers } = await db
      .from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    if (!managers || managers.length === 0) {
      return NextResponse.json({ ok: true, alerted: 0, message: '管理者なし' })
    }

    let alertedCount = 0

    for (const order of overdueOrders) {
      const sentAt = new Date(order.updated_at)
      const elapsed = Math.floor((now.getTime() - sentAt.getTime()) / 3600000) // 時間
      const itemCount = Array.isArray(order.items) ? order.items.length : '?'
      const totalText = order.total_amount
        ? `¥${order.total_amount.toLocaleString()}`
        : '金額未設定'
      const deliveryText = order.delivery_date
        ? `配達希望日: ${order.delivery_date}`
        : '配達日未設定'

      const message =
        `⚠️ 発注未確認アラート\n\n` +
        `業者「${order.supplier_name}」から、発注送信から${elapsed}時間経過しても確認が取れていません。\n\n` +
        `📦 内容: ${itemCount}品 / ${totalText}\n` +
        `📅 ${deliveryText}\n` +
        (order.note ? `📝 備考: ${order.note}\n` : '') +
        `\n電話やLINEで確認してください。`

      for (const manager of managers) {
        try {
          await sendLineMessage(manager.line_user_id, message)
        } catch (e) {
          console.error(`Alert send failed to ${manager.name}:`, e)
        }
      }

      // アラート送信済みフラグを立てる（二重送信防止）
      await db.from('orders').update({
        alert_sent_at: now.toISOString(),
      }).eq('id', order.id)

      alertedCount++
    }

    return NextResponse.json({
      ok: true,
      alerted: alertedCount,
      orders: overdueOrders.map((o: { id: string; supplier_name: string }) => ({
        id: o.id,
        supplier: o.supplier_name,
      })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
