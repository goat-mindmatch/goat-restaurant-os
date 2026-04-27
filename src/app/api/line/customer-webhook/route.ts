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
import { replyCustomerLineMessage } from '@/lib/line-customer'

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
    console.error('[customer-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const events = body.events ?? []

  console.log(`[customer-webhook] received ${events.length} event(s)`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await Promise.all(events.map(async (event: any) => {
    const userId = event.source?.userId
    const replyToken = event.replyToken ?? null

    console.log(`[customer-webhook] event: type=${event.type}, userId=${userId}, hasReplyToken=${!!replyToken}`)

    if (!userId) {
      console.warn('[customer-webhook] userId missing, skipping')
      return
    }

    // replyToken がない場合は応答不要イベント（unfollow等）なのでスキップ
    if (!replyToken) {
      console.log(`[customer-webhook] no replyToken for event type=${event.type}, skip`)
      return
    }

    try {
      // 友だち追加 → ウェルカムメッセージ（Reply API）
      if (event.type === 'follow') {
        await replyCustomerLineMessage(
          replyToken,
          `はじめまして！🍜\n「人類みなまぜそば」公式アカウントです。\n\n「口コミを書く」と送ると口コミフォームのURLをお送りします。\n\nいつもありがとうございます！`
        )
        console.log(`[customer-webhook] follow reply sent to ${userId}`)
        return
      }

      if (event.type !== 'message' || event.message?.type !== 'text') return

      // テキストメッセージへの返信はすべて Reply API（無料・無制限）
      const text = event.message.text.trim()
      console.log(`[customer-webhook] text="${text}"`)

      switch (text) {
        case '口コミを書く':
        case 'クチコミ':
        case '⭐ 口コミを書く':
          await replyCustomerLineMessage(
            replyToken,
            `⭐ ご来店ありがとうございました！\n\n口コミのご協力をお願いします🙏\nタップしてフォームを開いてください👇\n${BASE_URL}/review?uid=${userId}`
          )
          console.log(`[customer-webhook] review URL sent to ${userId}`)
          break
        case '営業情報':
        case '📅 営業情報':
          await replyCustomerLineMessage(
            replyToken,
            `📍 人類みなまぜそば\n営業時間：11:00〜22:00\n定休日：不定休\n\n詳細情報は店舗へお問い合わせください。`
          )
          break
        case 'クーポン':
        case '🎟️ クーポン':
          await replyCustomerLineMessage(
            replyToken,
            `🎟️ 現在配信中のクーポンはありません。\n次回配信をお楽しみに！`
          )
          break
        default:
          console.log(`[customer-webhook] unhandled text="${text}", skip`)
          break
      }
    } catch (err) {
      // エラーをログに残す（LINEには200を返してリトライさせない）
      console.error(`[customer-webhook] ERROR for userId=${userId}:`, err)
    }
  }))

  return NextResponse.json({ ok: true })
}
