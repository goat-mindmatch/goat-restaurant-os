export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/line/set-default-richmenu
 * 画像アップロード済みのスタッフメニューをデフォルトに設定する
 * （画像なし状態では LINE API が受け付けないため、アップロード後に別途実行する）
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const STAFF_MENU_NAME  = 'GOAT Staff Menu v3'
const MANAGER_MENU_NAME = 'GOAT Manager Menu v2'
const TENANT_ID = process.env.TENANT_ID!

export async function POST() {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'LINE_STAFF_CHANNEL_ACCESS_TOKEN 未設定' }, { status: 500 })
  }

  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // 1. メニュー一覧からIDを取得
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: h })
  if (!listRes.ok) {
    return NextResponse.json({ error: `メニュー一覧取得失敗: ${listRes.status}` }, { status: 500 })
  }
  const listData = await listRes.json() as { richmenus: { richMenuId: string; name: string }[] }
  const menus = listData.richmenus ?? []

  const staffMenu   = menus.find(m => m.name === STAFF_MENU_NAME)
  const managerMenu = menus.find(m => m.name === MANAGER_MENU_NAME)

  if (!staffMenu) {
    return NextResponse.json(
      { error: `"${STAFF_MENU_NAME}" が見つかりません。先にSTEP1でメニューを作成してください。` },
      { status: 404 }
    )
  }

  const results: Record<string, unknown> = { staff_menu_id: staffMenu.richMenuId }

  // 2. スタッフメニューを新規フォロワーのデフォルトに設定
  const defaultRes = await fetch(
    `https://api.line.me/v2/bot/richmenu/default/${staffMenu.richMenuId}`,
    { method: 'POST', headers: h }
  )
  results.set_default_status = defaultRes.status
  results.set_default_ok     = defaultRes.ok
  if (!defaultRes.ok) {
    results.set_default_error = await defaultRes.text()
  }

  // 3. 既存の全フォロワーにスタッフメニューを紐付け
  const allRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${staffMenu.richMenuId}`,
    { method: 'POST', headers: h }
  )
  results.set_all_status = allRes.status
  results.set_all_ok     = allRes.ok
  if (!allRes.ok) {
    results.set_all_error = await allRes.text()
  }

  // 4. 経営者には個別にmanagerMenuを設定
  if (managerMenu) {
    results.manager_menu_id = managerMenu.richMenuId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    const managerResults: { name: string; status: number }[] = []
    for (const m of managers ?? []) {
      const res = await fetch(
        `https://api.line.me/v2/bot/user/${m.line_user_id}/richmenu/${managerMenu.richMenuId}`,
        { method: 'POST', headers: h }
      )
      managerResults.push({ name: m.name, status: res.status })
    }
    results.managers_updated = managerResults
  }

  const success = results.set_default_ok && results.set_all_ok
  return NextResponse.json({ ok: success, ...results }, { status: success ? 200 : 500 })
}
