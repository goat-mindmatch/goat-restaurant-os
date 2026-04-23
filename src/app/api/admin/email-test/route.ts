export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/email-test?to=xxx@yyy.com
 * SendGrid の設定確認 & テストメール送信
 */

import { NextRequest, NextResponse } from 'next/server'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? ''
const FROM_EMAIL       = process.env.FROM_EMAIL ?? ''

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to')

  // 設定状態チェック
  const config = {
    SENDGRID_API_KEY: SENDGRID_API_KEY ? `設定済み（末尾: ...${SENDGRID_API_KEY.slice(-6)}）` : '❌ 未設定',
    FROM_EMAIL:       FROM_EMAIL       ? `設定済み（${FROM_EMAIL}）`                           : '❌ 未設定',
  }

  if (!to) {
    return NextResponse.json({
      config,
      usage: 'テスト送信: /api/admin/email-test?to=your@email.com',
    })
  }

  if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    return NextResponse.json({
      ok: false,
      error: 'SENDGRID_API_KEY または FROM_EMAIL が Vercel 環境変数に未設定です',
      config,
    }, { status: 400 })
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
        from: { email: FROM_EMAIL, name: '人類みなまぜそば GOATシステム' },
        subject: '【テスト】GOATシステム メール送信確認',
        content: [{
          type: 'text/plain',
          value: `これはGOATシステムからのテストメールです。\n\nこのメールが届いていれば、メール送信の設定は正常です。\n\n送信元: ${FROM_EMAIL}\n送信先: ${to}\n送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
        }],
      }),
    })

    if (res.status === 202) {
      return NextResponse.json({ ok: true, message: `✅ ${to} へのテストメールを送信しました`, config })
    }

    const detail = await res.text()
    return NextResponse.json({
      ok: false,
      error: `SendGrid エラー (HTTP ${res.status}): ${detail}`,
      config,
    }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), config }, { status: 500 })
  }
}
