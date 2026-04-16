/**
 * LINE スタッフ用アカウント クライアント
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN!

// LINE メッセージ送信
export async function sendLineMessage(userId: string, text: string) {
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
    throw new Error(`LINE send error: ${err}`)
  }
}

// LINE クイックリプライ付きメッセージ
export async function sendQuickReply(
  userId: string,
  text: string,
  items: { label: string; text: string }[]
) {
  const quickReply = {
    items: items.map((item) => ({
      type: 'action',
      action: { type: 'message', label: item.label, text: item.text },
    })),
  }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text, quickReply }],
    }),
  })
  if (!res.ok) throw new Error(`LINE quickReply error: ${await res.text()}`)
}

// リッチメニュー用テンプレート（ボタン文言）
export const RICH_MENU_ACTIONS = {
  CLOCK_IN:        '出勤',
  CLOCK_OUT:       '退勤',
  SHIFT_REQUEST:   'シフト希望提出',
  SHIFT_CHECK:     'シフト確認',
  ORDER_REQUEST:   '発注依頼',
  ADMIN:           '管理メニュー',  // パスワード保護
} as const
