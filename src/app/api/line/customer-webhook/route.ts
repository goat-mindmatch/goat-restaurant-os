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
import { sendCustomerMessage } from '@/lib/line-customer'

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
    const now = Date.now()
    const userId = event.source?.userId
    const replyToken = event.replyToken ?? null
    const ts = typeof event.timestamp === 'number' ? event.timestamp : null
    const eventAge = ts !== null ? now - ts : Infinity

    // イベントの生データを出力（原因特定用）
    console.log(`[customer-webhook] RAW event: ${JSON.stringify({
      type: event.type,
      timestamp: event.timestamp,
      now,
      eventAge: isFinite(eventAge) ? eventAge : 'no-timestamp',
      replyToken: replyToken ? replyToken.slice(0, 20) + '...' : null,
      userId,
      messageType: event.message?.type,
      text: event.message?.text,
    })}`)

    console.log(`[customer-webhook] event: type=${event.type}, userId=${userId}, hasReplyToken=${!!replyToken}, age=${isFinite(eventAge) ? eventAge + 'ms' : 'no-timestamp'}`)

    if (!userId) {
      console.warn('[customer-webhook] userId missing, skipping')
      return
    }

    // replyToken がない場合は応答不要イベント（unfollow等）なのでスキップ
    if (!replyToken) {
      console.log(`[customer-webhook] no replyToken for event type=${event.type}, skip`)
      return
    }

    // replyToken は30秒で失効 → 古いリトライイベントはスキップ
    // タイムスタンプがない場合も安全のためスキップ
    if (!isFinite(eventAge) || eventAge > 28000) {
      console.warn(`[customer-webhook] event too old or no timestamp (age=${isFinite(eventAge) ? eventAge + 'ms' : 'no-timestamp'}), skip`)
      return
    }

    try {
      // 友だち追加 → ウェルカムメッセージ
      if (event.type === 'follow') {
        const result = await sendCustomerMessage(
          replyToken,
          userId,
          `はじめまして！🍜\n「人類みなまぜそば」公式アカウントです。\n\n「口コミを書く」と送ると口コミフォームのURLをお送りします。\n\nいつもありがとうございます！`
        )
        console.log(`[customer-webhook] follow sent via ${result.method} to ${userId}`)
        return
      }

      if (event.type !== 'message' || event.message?.type !== 'text') return

      const text = event.message.text.trim()
      console.log(`[customer-webhook] text="${text}"`)

      switch (text) {
        case '口コミを書く':
        case 'クチコミ':
        case '⭐ 口コミを書く': {
          const result = await sendCustomerMessage(
            replyToken,
            userId,
            `⭐ ご来店ありがとうございました！\n\n口コミのご協力をお願いします🙏\nタップしてフォームを開いてください👇\n${BASE_URL}/review?uid=${userId}`
          )
          console.log(`[customer-webhook] review URL sent via ${result.method} to ${userId}`)
          break
        }
        case '営業情報':
        case '📅 営業情報':
          await sendCustomerMessage(replyToken, userId, `📍 人類みなまぜそば\n営業時間：11:00〜22:00\n定休日：不定休\n\n詳細情報は店舗へお問い合わせください。`)
          break
        case 'クーポン':
        case '🎟️ クーポン':
          await sendCustomerMessage(replyToken, userId, `🎟️ 現在配信中のクーポンはありません。\n次回配信をお楽しみに！`)
          break
        default:
          console.log(`[customer-webhook] unhandled text="${text}", skip`)
          break
      }
    } catch (err) {
      console.error(`[customer-webhook] ERROR for userId=${userId}:`, err)
    }
  }))

  return NextResponse.json({ ok: true })
}
