/**
 * LINE スタッフ用アカウント クライアント
 *
 * 【API使い分け方針】
 * - Reply API  : webhook イベントへの直接返信 → 完全無料・上限なし（replyToken必須）
 * - Push API   : 非同期通知（replyToken なし、または2通目以降）→ 月200通の無料枠を消費
 *
 * 通常の返信は必ず Reply API を使い、Push API は管理者通知など最小限に留める。
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN!

/**
 * Reply API でメッセージ送信（無料・上限なし）
 * replyToken はイベントごとに1回のみ使用可。30秒以内に呼ぶこと。
 */
export async function replyLineMessage(replyToken: string, text: string) {
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
    throw new Error(`LINE reply error: ${err}`)
  }
}

/**
 * Push API でメッセージ送信（月200通の無料枠を消費）
 * replyToken が使えない場面（非同期処理後の通知など）でのみ使う。
 */
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
    throw new Error(`LINE push error: ${err}`)
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

// Flex Messageでクーポンカードを送信
export async function sendCouponFlex(
  userId: string,
  couponCode: string,
  opts?: {
    storeName?: string
    title?: string
    description?: string
    expiryDays?: number
  }
) {
  const storeName = opts?.storeName ?? '人類みなまぜそば'
  const title = opts?.title ?? '口コミ特典'
  const description = opts?.description ?? '次回来店時 ¥100 OFF'
  const expiryDays = opts?.expiryDays ?? 30
  const expiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  const expiryStr = `${expiry.getFullYear()}/${String(expiry.getMonth() + 1).padStart(2, '0')}/${String(expiry.getDate()).padStart(2, '0')}`
  const couponUrl = `https://goat-restaurant-os.vercel.app/coupon/${couponCode}`

  const flexMessage = {
    type: 'flex',
    altText: `🎫 ${title} - ${couponCode}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `🍜 ${storeName}`,
            color: '#ffffff',
            size: 'sm',
            weight: 'bold',
          },
        ],
        backgroundColor: '#DC2626',
        paddingAll: '15px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'xl',
            margin: 'md',
            color: '#1a1a1a',
          },
          {
            type: 'text',
            text: description,
            size: 'md',
            color: '#666666',
            margin: 'sm',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'コード', size: 'xs', color: '#aaaaaa', flex: 1 },
                  { type: 'text', text: couponCode, size: 'md', color: '#DC2626', weight: 'bold', flex: 3, align: 'end' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '有効期限', size: 'xs', color: '#aaaaaa', flex: 1 },
                  { type: 'text', text: expiryStr, size: 'sm', color: '#555555', flex: 3, align: 'end' },
                ],
              },
            ],
          },
        ],
        paddingAll: '20px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#DC2626',
            action: {
              type: 'uri',
              label: '🎫 クーポンを使う',
              uri: couponUrl,
            },
            height: 'md',
          },
          {
            type: 'text',
            text: '※次回来店時にスタッフにこの画面をお見せください',
            size: 'xxs',
            color: '#aaaaaa',
            align: 'center',
            margin: 'sm',
          },
        ],
        paddingAll: '15px',
      },
    },
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [flexMessage],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LINE flex error: ${err}`)
  }
}

// 汎用 Flex Message 送信
export async function sendFlexMessage(
  userId: string,
  altText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flexContents: Record<string, any>
) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: 'flex',
          altText,
          contents: flexContents,
        },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LINE flex error: ${err}`)
  }
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
