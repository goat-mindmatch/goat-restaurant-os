export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * LINE リッチメニュー自動セットアップ
 * POST /api/line/setup-richmenu
 *
 * フロー:
 * 1. 既存リッチメニューを全削除
 * 2. 新しいリッチメニューを作成（6ボタン、2行3列）
 * 3. 全ユーザーにデフォルト設定
 */

import { NextResponse } from 'next/server'

const BASE_URL = 'https://goat-restaurant-os.vercel.app'

const RICH_MENU_BODY = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Staff Menu v1',
  chatBarText: 'メニューを開く',
  areas: [
    // 上段左: 出勤打刻
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: 'message', label: '出勤打刻', text: '出勤' },
    },
    // 上段中: 退勤打刻
    {
      bounds: { x: 834, y: 0, width: 833, height: 843 },
      action: { type: 'message', label: '退勤打刻', text: '退勤' },
    },
    // 上段右: シフト希望提出
    {
      bounds: { x: 1668, y: 0, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: 'シフト希望提出',
        uri: `${BASE_URL}/shift-form?uid={userId}`,
        altUri: {
          desktop: `${BASE_URL}/shift-form?uid={userId}`,
        },
      },
    },
    // 下段左: 発注依頼
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: '発注依頼',
        uri: `${BASE_URL}/order-form?uid={userId}`,
        altUri: {
          desktop: `${BASE_URL}/order-form?uid={userId}`,
        },
      },
    },
    // 下段中: シフト確認
    {
      bounds: { x: 834, y: 843, width: 833, height: 843 },
      action: { type: 'message', label: 'シフト確認', text: 'シフト確認' },
    },
    // 下段右: ヘルプ
    {
      bounds: { x: 1668, y: 843, width: 833, height: 843 },
      action: { type: 'message', label: 'ヘルプ', text: 'ヘルプ' },
    },
  ],
}

export async function POST() {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'LINE_STAFF_CHANNEL_ACCESS_TOKEN が設定されていません' },
      { status: 500 }
    )
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  try {
    // 1. 既存リッチメニューの一覧を取得して全削除
    const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers })
    if (listRes.ok) {
      const listData = await listRes.json() as { richmenus: { richMenuId: string }[] }
      const deletePromises = (listData.richmenus ?? []).map((menu) =>
        fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
          method: 'DELETE',
          headers,
        })
      )
      await Promise.all(deletePromises)
    }

    // 2. リッチメニュー作成
    const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers,
      body: JSON.stringify(RICH_MENU_BODY),
    })

    if (!createRes.ok) {
      const errBody = await createRes.text()
      return NextResponse.json(
        { error: `リッチメニュー作成失敗: ${createRes.status}`, detail: errBody },
        { status: 500 }
      )
    }

    const createData = await createRes.json() as { richMenuId: string }
    const richMenuId = createData.richMenuId

    // 3. 全ユーザーにデフォルト設定
    const setDefaultRes = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      { method: 'POST', headers }
    )

    if (!setDefaultRes.ok) {
      const errBody = await setDefaultRes.text()
      return NextResponse.json(
        {
          error: `デフォルト設定失敗: ${setDefaultRes.status}`,
          detail: errBody,
          richMenuId,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, richMenuId })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: '予期しないエラー', detail: message }, { status: 500 })
  }
}
