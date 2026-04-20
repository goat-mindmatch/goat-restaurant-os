export const dynamic = 'force-dynamic'

/**
 * POST /api/loyalty/send-coupon
 * お客様のLINEにクーポンを送信
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const LINE_CUSTOMER_TOKEN = process.env.LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN!

export async function POST(req: NextRequest) {
  try {
    const { customerId, lineUserId } = await req.json()
    if (!lineUserId) return NextResponse.json({ error: 'no lineUserId' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 顧客情報取得
    const { data: customer } = await db
      .from('customer_loyalty')
      .select('points, visit_count, display_name')
      .eq('id', customerId)
      .eq('tenant_id', TENANT_ID)
      .single()

    if (!customer) return NextResponse.json({ error: 'customer not found' }, { status: 404 })

    const couponCode = `GOAT-${Date.now().toString(36).toUpperCase()}`

    // LINE Flex Message
    const flexMessage = {
      type: 'flex',
      altText: `🎫 ありがとうクーポン（${couponCode}）`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#DC2626',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: '🍜 人類みなまぜそば', color: '#ffffff', size: 'sm', weight: 'bold' },
            { type: 'text', text: '特別クーポン', color: '#ffffff', size: 'xl', weight: 'bold', margin: 'sm' },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '20px',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'お名前', size: 'xs', color: '#999', flex: 1 },
                { type: 'text', text: customer.display_name ?? 'お客様', size: 'sm', color: '#333', weight: 'bold', flex: 2, align: 'end' },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: '保有ポイント', size: 'xs', color: '#999', flex: 1 },
                { type: 'text', text: `${(customer.points ?? 0).toLocaleString()} pt`, size: 'sm', color: '#DC2626', weight: 'bold', flex: 2, align: 'end' },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: '来店回数', size: 'xs', color: '#999', flex: 1 },
                { type: 'text', text: `${customer.visit_count ?? 0} 回`, size: 'sm', color: '#333', flex: 2, align: 'end' },
              ],
            },
            { type: 'separator', margin: 'xl' },
            {
              type: 'text',
              text: '次回来店時 ¥300 OFF',
              size: 'lg',
              weight: 'bold',
              color: '#DC2626',
              align: 'center',
              margin: 'xl',
            },
            {
              type: 'text',
              text: couponCode,
              size: 'sm',
              color: '#666',
              align: 'center',
              margin: 'sm',
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '12px',
          contents: [
            {
              type: 'text',
              text: '※次回来店時にスタッフにこの画面をご提示ください',
              size: 'xxs',
              color: '#aaa',
              align: 'center',
              wrap: true,
            },
          ],
        },
      },
    }

    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_CUSTOMER_TOKEN}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [flexMessage] }),
    })

    if (!lineRes.ok) {
      const err = await lineRes.text()
      console.error('LINE error:', err)
      return NextResponse.json({ error: 'LINE send failed' }, { status: 500 })
    }

    // ログ保存
    await db.from('loyalty_transactions').insert({
      tenant_id: TENANT_ID,
      customer_id: customerId,
      points: 0,
      type: 'coupon',
      description: `クーポン送信: ${couponCode}`,
    })

    return NextResponse.json({ ok: true, couponCode })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
