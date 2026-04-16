/**
 * LINE 顧客用アカウント クライアント
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN ?? ''

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
    throw new Error(`Customer LINE send error: ${err}`)
  }
}
