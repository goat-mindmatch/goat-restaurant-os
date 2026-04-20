export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/line/upload-richmenu-image
 * FormData: file (image/jpeg or image/png), menu_type ('staff' | 'manager')
 *
 * 1. LINE からリッチメニュー一覧を取得
 * 2. menu_type に対応するメニューIDを特定
 * 3. 画像をそのメニューにアップロード
 */

import { NextRequest, NextResponse } from 'next/server'

const MENU_NAMES: Record<string, string> = {
  staff:   'GOAT Staff Menu v3',
  manager: 'GOAT Manager Menu v2',
}

export async function POST(req: NextRequest) {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'LINE_STAFF_CHANNEL_ACCESS_TOKEN 未設定' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData の解析に失敗しました' }, { status: 400 })
  }

  const file      = formData.get('file') as File | null
  const menuType  = formData.get('menu_type') as string | null

  if (!file)     return NextResponse.json({ error: 'file が必要です' }, { status: 400 })
  if (!menuType || !MENU_NAMES[menuType]) {
    return NextResponse.json({ error: 'menu_type は staff または manager を指定してください' }, { status: 400 })
  }

  const contentType = file.type || 'image/jpeg'
  if (!['image/jpeg', 'image/png'].includes(contentType)) {
    return NextResponse.json({ error: '画像は JPEG または PNG のみ対応しています' }, { status: 400 })
  }

  const authHeaders = { Authorization: `Bearer ${token}` }

  // 1. リッチメニュー一覧を取得してIDを特定
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: authHeaders })
  if (!listRes.ok) {
    return NextResponse.json(
      { error: `リッチメニュー一覧取得失敗: ${listRes.status}`, detail: await listRes.text() },
      { status: 500 }
    )
  }
  const listData = await listRes.json() as { richmenus: { richMenuId: string; name: string }[] }
  const targetName = MENU_NAMES[menuType]
  const menu = (listData.richmenus ?? []).find(m => m.name === targetName)

  if (!menu) {
    return NextResponse.json(
      { error: `"${targetName}" が見つかりません。先にリッチメニューをセットアップしてください。` },
      { status: 404 }
    )
  }

  // 2. 画像をアップロード
  const imageBuffer = await file.arrayBuffer()
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${menu.richMenuId}/content`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    }
  )

  if (!uploadRes.ok) {
    return NextResponse.json(
      { error: `画像アップロード失敗: ${uploadRes.status}`, detail: await uploadRes.text() },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, menu_id: menu.richMenuId, menu_name: targetName })
}
