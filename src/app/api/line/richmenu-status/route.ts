export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/line/richmenu-status
 * 現在LINEに登録されているリッチメニューの状態を返す
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'LINE_STAFF_CHANNEL_ACCESS_TOKEN 未設定' }, { status: 500 })
  }

  const headers = { Authorization: `Bearer ${token}` }

  try {
    // リッチメニュー一覧
    const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers })
    const listData = await listRes.json() as { richmenus?: { richMenuId: string; name: string; selected: boolean }[] }

    // デフォルトリッチメニュー（新規フォロワー向けのデフォルト設定）
    const defaultRes = await fetch('https://api.line.me/v2/bot/richmenu/default', { headers })
    const defaultData = defaultRes.ok ? await defaultRes.json() as { richMenuId?: string } : {}

    // 各メニューの画像有無チェック（HEADリクエスト）
    const menus = await Promise.all(
      (listData.richmenus ?? []).map(async (m) => {
        const imgRes = await fetch(
          `https://api-data.line.me/v2/bot/richmenu/${m.richMenuId}/content`,
          { method: 'GET', headers }
        )
        return {
          id: m.richMenuId,
          name: m.name,
          selected: m.selected,
          is_default: defaultData.richMenuId === m.richMenuId,
          has_image: imgRes.ok && imgRes.status !== 404,
          image_content_type: imgRes.ok ? imgRes.headers.get('content-type') : null,
        }
      })
    )

    return NextResponse.json({ menus, default_menu_id: defaultData.richMenuId ?? null })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
