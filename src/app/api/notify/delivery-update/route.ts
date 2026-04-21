export const dynamic = 'force-dynamic'

/**
 * POST /api/notify/delivery-update
 * デリバリー取込結果をLINE公式アカウント経由でオーナーに通知
 *
 * body: {
 *   message: string        // 通知メッセージ
 *   type?: 'success' | 'warning' | 'error'
 * }
 */

import { NextRequest, NextResponse } from 'next/server'

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN!
const LINE_OWNER_USER_ID        = process.env.LINE_OWNER_USER_ID!  // オーナーのLINE User ID

export async function POST(req: NextRequest) {
  try {
    const { message, type = 'success' } = await req.json()
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_OWNER_USER_ID) {
      console.warn('LINE_OWNER_USER_ID or LINE_STAFF_CHANNEL_ACCESS_TOKEN not set')
      return NextResponse.json({ ok: true, skipped: true, reason: 'LINE not configured' })
    }

    const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : '✅'
    const text  = `${emoji} ${message}`

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to:       LINE_OWNER_USER_ID,
        messages: [{ type: 'text', text }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('LINE push error:', err)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
