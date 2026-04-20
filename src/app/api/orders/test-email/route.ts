export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/test-email
 * SendGridの設定診断 + テストメール送信
 * 使い方: ブラウザで開くだけ
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
  const FROM_EMAIL       = process.env.FROM_EMAIL

  const result: Record<string, unknown> = {
    sendgrid_key_set: !!SENDGRID_API_KEY,
    sendgrid_key_prefix: SENDGRID_API_KEY ? SENDGRID_API_KEY.slice(0, 6) + '...' : null,
    from_email_set: !!FROM_EMAIL,
    from_email: FROM_EMAIL ?? null,
  }

  if (!SENDGRID_API_KEY) {
    return NextResponse.json({ ...result, error: 'SENDGRID_API_KEY が未設定です' }, { status: 500 })
  }
  if (!FROM_EMAIL) {
    return NextResponse.json({ ...result, error: 'FROM_EMAIL が未設定です' }, { status: 500 })
  }

  // 1. SendGrid 送信者認証状態を確認
  try {
    const senderRes = await fetch('https://api.sendgrid.com/v3/verified_senders', {
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
    })
    const senderData = await senderRes.json() as {
      results?: { from_email: string; verified: boolean; locked: boolean }[]
    }
    result.sender_auth_status = senderRes.status
    result.verified_senders = senderData.results?.map(s => ({
      email: s.from_email,
      verified: s.verified,
    })) ?? []

    const isFromEmailVerified = senderData.results?.some(
      s => s.from_email === FROM_EMAIL && s.verified
    )
    result.from_email_verified = isFromEmailVerified ?? false

    if (!isFromEmailVerified) {
      result.warning = `⚠️ ${FROM_EMAIL} はSendGridで送信者認証されていません。これがメール未送信の原因です。`
    }
  } catch (e) {
    result.sender_check_error = String(e)
  }

  // 2. テストメール送信（自分宛）
  const testTo = FROM_EMAIL // 自分宛に送る
  try {
    const sendRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: testTo }] }],
        from: { email: FROM_EMAIL },
        subject: '【テスト】GOAT Restaurant OS メール送信テスト',
        content: [{
          type: 'text/plain',
          value: 'このメールが届いていれば、SendGrid設定は正常です。\n\nGOAT Restaurant OS より',
        }],
      }),
    })
    result.test_send_status = sendRes.status
    result.test_send_ok = sendRes.status === 202
    if (sendRes.status !== 202) {
      result.test_send_error = await sendRes.text()
    } else {
      result.test_send_message = `✅ テストメールを ${testTo} に送信しました。受信トレイを確認してください。`
    }
  } catch (e) {
    result.test_send_exception = String(e)
  }

  return NextResponse.json(result)
}
