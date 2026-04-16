export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/line/customer-webhook
 * 顧客用LINEアカウント用Webhook
 * - 友だち追加時: ウェルカムメッセージ
 * - 「口コミを書く」などのテキストに反応
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendCustomerLineMessage } from '@/lib/line-customer'

const CHANNEL_SECRET = process.env.LINE_CUSTOMER_CHANNEL_SECRET ?? ''
const BASE_URL = 'https://goat-restaurant-os.vercel.app'

function verifySignature(body: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return false
  const hash = crypto.createHmac('SHA256', CHANNEL_SECRET).update(body).digest('base64')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const events = body.events ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await Promise.all(events.map(async (event: any) => {
    const userId = event.source?.userId
    if (!userId) return

    if (event.type === 'follow') {
      await sendCustomerLineMessage(
        userId,
        `はじめまして！🍜\n「人類みなまぜそば」公式アカウントです。\n\n下のメニューから：\n・⭐ 口コミを書く\n・📅 営業情報\n・🎟️ クーポン\nなどがご利用いただけます。\n\nいつもありがとうございます！`
      )
      return
    }

    if (event.type !== 'message' || event.message?.type !== 'text') return

    const text = event.message.text.trim()
    switch (text) {
      case '口コミを書く':
      case 'クチコミ':
      case '⭐ 口コミを書く':
        await sendCustomerLineMessage(
          userId,
          `⭐ ご来店ありがとうございました！\n\n口コミのご協力をお願いします🙏\nタップしてフォームを開いてください👇\n${BASE_URL}/review?uid=${userId}`
        )
        break
      case '営業情報':
      case '📅 営業情報':
        await sendCustomerLineMessage(
          userId,
          `📍 人類みなまぜそば\n営業時間：11:00〜22:00\n定休日：不定休\n\n詳細情報は店舗へお問い合わせください。`
        )
        break
      case 'クーポン':
      case '🎟️ クーポン':
        await sendCustomerLineMessage(
          userId,
          `🎟️ 現在配信中のクーポンはありません。\n次回配信をお楽しみに！`
        )
        break
      default:
        // 何もしない（一般メッセージはスルー）
        break
    }
  }))

  return NextResponse.json({ ok: true })
}
