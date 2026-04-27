/**
 * LINE 顧客用アカウント クライアント
 *
 * Reply API  … 無料・無制限。ユーザーのメッセージへの返信に使う。
 * Push API   … 月次上限あり（無料枠500通）。能動的な送信にのみ使う。
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN ?? ''

/**
 * Reply API（無料・無制限）
 * Webhookイベントの replyToken を使って返信する。
 * replyToken はイベント受信から30秒以内に使用すること。
 */
export async function replyCustomerLineMessage(replyToken: string, text: string) {
  if (!CHANNEL_ACCESS_TOKEN) {
    console.warn('LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN not set')
    return
  }
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Customer LINE reply error: ${err}`)
  }
}

/**
 * Push API（月次上限あり）
 * クーポン送信など、ユーザーのアクションに関係ない能動的な送信にのみ使う。
 */
export async function sendCustomerLineMessage(userId: string, text: string) {
  if (!CHANNEL_ACCESS_TOKEN) {
    console.warn('LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN not set')
    return
  }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Customer LINE push error: ${err}`)
  }
}
