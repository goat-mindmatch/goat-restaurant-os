/**
 * LINE 顧客用アカウント クライアント
 *
 * Reply API  … 無料・無制限。replyToken を使う（30秒以内に使用必須）。
 * Push API   … 月次上限あり（無料枠500通）。フォールバックまたは能動送信に使う。
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN ?? ''

/**
 * Reply API（無料・無制限）
 * 失敗した場合は例外を投げる（呼び出し元でPush APIにフォールバックする）
 */
export async function replyCustomerLineMessage(replyToken: string, text: string): Promise<void> {
  if (!CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN not set')
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
    throw new Error(`Reply API error: ${err}`)
  }
}

/**
 * Push API（月次上限あり）
 * Reply APIが失敗したときのフォールバック、またはクーポン送信などの能動的な送信に使う。
 */
export async function sendCustomerLineMessage(userId: string, text: string): Promise<void> {
  if (!CHANNEL_ACCESS_TOKEN) {
    throw new Error('LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN not set')
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
    throw new Error(`Push API error: ${err}`)
  }
}

/**
 * Reply API → Push API フォールバック付き送信
 * テスト環境や replyToken が切れた場合でも確実に届ける。
 */
export async function sendCustomerMessage(
  replyToken: string | null,
  userId: string,
  text: string
): Promise<{ method: 'reply' | 'push' }> {
  // Reply API を試みる
  if (replyToken) {
    try {
      await replyCustomerLineMessage(replyToken, text)
      console.log(`[line-customer] Reply API 成功 userId=${userId}`)
      return { method: 'reply' }
    } catch (err) {
      console.warn(`[line-customer] Reply API 失敗 → Push APIにフォールバック: ${err}`)
    }
  }

  // Push API にフォールバック
  await sendCustomerLineMessage(userId, text)
  console.log(`[line-customer] Push API 成功 userId=${userId}`)
  return { method: 'push' }
}
