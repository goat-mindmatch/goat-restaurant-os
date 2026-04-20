export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/line/upload-richmenu-image
 * FormData: file (image/jpeg or image/png), menu_type ('staff' | 'manager')
 *
 * LINEはメニューIDをキャッシュキーとして使うため、
 * 画像を差し替えても同じIDのままでは端末に反映されない。
 * このエンドポイントは以下を一括実行する:
 *   1. 対象メニュー（staff or manager）を削除
 *   2. 同じ定義で新規作成（新IDを取得）
 *   3. 新IDに画像をアップロード
 *   4. スタッフメニューなら全ユーザーに紐付け / 経営者メニューならmanager個人に設定
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const BASE_URL = 'https://goat-restaurant-os.vercel.app'
const TENANT_ID = process.env.TENANT_ID!

const C = [0, 834, 1667]
const W = [834, 833, 833]
const R = [0, 843]
const H = 843

const STAFF_MENU_DEF = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Staff Menu v3',
  chatBarText: 'スタッフメニュー',
  areas: [
    { bounds: { x: C[0], y: R[0], width: W[0], height: H }, action: { type: 'message', label: '出勤打刻', text: '出勤' } },
    { bounds: { x: C[1], y: R[0], width: W[1], height: H }, action: { type: 'message', label: '退勤打刻', text: '退勤' } },
    { bounds: { x: C[2], y: R[0], width: W[2], height: H }, action: { type: 'message', label: 'シフト希望提出', text: 'シフト希望提出' } },
    { bounds: { x: C[0], y: R[1], width: W[0], height: H }, action: { type: 'message', label: '経営メニューへ', text: '経営メニューへ切替' } },
    { bounds: { x: C[1], y: R[1], width: W[1], height: H }, action: { type: 'message', label: '発注依頼', text: '発注依頼' } },
    { bounds: { x: C[2], y: R[1], width: W[2], height: H }, action: { type: 'message', label: 'シフト確認', text: 'シフト確認' } },
  ],
}

const MANAGER_MENU_DEF = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Manager Menu v2',
  chatBarText: '経営メニュー',
  areas: [
    { bounds: { x: C[0], y: R[0], width: W[0], height: H }, action: { type: 'message', label: '売上確認', text: '本日の売上' } },
    { bounds: { x: C[1], y: R[0], width: W[1], height: H }, action: { type: 'uri', label: 'PL確認', uri: `${BASE_URL}/dashboard/pl` } },
    { bounds: { x: C[2], y: R[0], width: W[2], height: H }, action: { type: 'uri', label: 'シフト確認', uri: `${BASE_URL}/dashboard/shifts` } },
    { bounds: { x: C[0], y: R[1], width: W[0], height: H }, action: { type: 'message', label: 'スタッフメニューへ', text: 'スタッフメニューへ切替' } },
    { bounds: { x: C[1], y: R[1], width: W[1], height: H }, action: { type: 'uri', label: '発注状況', uri: `${BASE_URL}/dashboard/orders` } },
    { bounds: { x: C[2], y: R[1], width: W[2], height: H }, action: { type: 'uri', label: 'ダッシュボード', uri: `${BASE_URL}/dashboard` } },
  ],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MENU_DEFS: Record<string, any> = {
  staff:   STAFF_MENU_DEF,
  manager: MANAGER_MENU_DEF,
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

  const file     = formData.get('file') as File | null
  const menuType = formData.get('menu_type') as string | null

  if (!file)                       return NextResponse.json({ error: 'file が必要です' }, { status: 400 })
  if (!menuType || !MENU_DEFS[menuType]) return NextResponse.json({ error: 'menu_type は staff または manager' }, { status: 400 })

  const contentType = file.type || 'image/jpeg'
  if (!['image/jpeg', 'image/png'].includes(contentType)) {
    return NextResponse.json({ error: '画像は JPEG または PNG のみ対応しています' }, { status: 400 })
  }

  const auth     = { Authorization: `Bearer ${token}` }
  const authJson = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const menuDef  = MENU_DEFS[menuType]
  const menuName = menuDef.name

  // 1. 既存の同名メニューを削除（IDを変えるため）
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: auth })
  if (listRes.ok) {
    const listData = await listRes.json() as { richmenus: { richMenuId: string; name: string }[] }
    const oldMenu = (listData.richmenus ?? []).find(m => m.name === menuName)
    if (oldMenu) {
      await fetch(`https://api.line.me/v2/bot/richmenu/${oldMenu.richMenuId}`, {
        method: 'DELETE', headers: auth,
      })
    }
  }

  // 2. 新規メニューを作成（新しいIDが発行される）
  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST', headers: authJson, body: JSON.stringify(menuDef),
  })
  if (!createRes.ok) {
    return NextResponse.json(
      { error: `メニュー作成失敗: ${createRes.status}`, detail: await createRes.text() },
      { status: 500 }
    )
  }
  const { richMenuId: newMenuId } = await createRes.json() as { richMenuId: string }

  // 3. 新IDに画像をアップロード
  const imageBuffer = await file.arrayBuffer()
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${newMenuId}/content`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: imageBuffer,
    }
  )
  if (!uploadRes.ok) {
    return NextResponse.json(
      { error: `画像アップロード失敗: ${uploadRes.status}`, detail: await uploadRes.text() },
      { status: 500 }
    )
  }

  // 4. スタッフメニューなら全ユーザーに紐付け
  if (menuType === 'staff') {
    await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${newMenuId}`, {
      method: 'POST', headers: auth,
    })
  }

  // 5. 経営者メニューなら manager ロールの個人に設定
  if (menuType === 'manager') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    for (const m of managers ?? []) {
      await fetch(`https://api.line.me/v2/bot/user/${m.line_user_id}/richmenu/${newMenuId}`, {
        method: 'POST', headers: auth,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    new_menu_id: newMenuId,
    menu_name: menuName,
    message: '削除→再作成→画像アップ→ユーザー紐付けを完了しました',
  })
}
