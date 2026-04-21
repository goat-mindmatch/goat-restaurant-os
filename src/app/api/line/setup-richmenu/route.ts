export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/line/setup-richmenu
 * リッチメニューをゼロから再作成して全スタッフに適用する
 *
 * メニュー定義の正本は src/lib/richmenu-defs.ts を参照。
 * ここでは定義を変更しない。
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { STAFF_MENU_DEF, MANAGER_MENU_DEF } from '@/lib/richmenu-defs'

const TENANT_ID = process.env.TENANT_ID!

export async function POST() {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'LINE_STAFF_CHANNEL_ACCESS_TOKEN が設定されていません' },
      { status: 500 }
    )
  }

  const jsonHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const authHeader  = { Authorization: `Bearer ${token}` }

  try {
    // 1. 既存リッチメニューを全削除（逐次実行して確実に消す）
    const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: authHeader })
    if (listRes.ok) {
      const listData = await listRes.json() as { richmenus: { richMenuId: string }[] }
      for (const menu of listData.richmenus ?? []) {
        await fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
          method: 'DELETE', headers: authHeader,
        })
      }
    }

    // 2. スタッフ用メニューを作成（src/lib/richmenu-defs.ts の定義を使用）
    const staffCreateRes = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify(STAFF_MENU_DEF),
    })
    if (!staffCreateRes.ok) {
      return NextResponse.json(
        { error: `スタッフメニュー作成失敗: ${staffCreateRes.status}`, detail: await staffCreateRes.text() },
        { status: 500 }
      )
    }
    const { richMenuId: staffMenuId } = await staffCreateRes.json() as { richMenuId: string }

    // 3. 経営者用メニューを作成（src/lib/richmenu-defs.ts の定義を使用）
    const managerCreateRes = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify(MANAGER_MENU_DEF),
    })
    if (!managerCreateRes.ok) {
      return NextResponse.json(
        { error: `経営者メニュー作成失敗: ${managerCreateRes.status}`, detail: await managerCreateRes.text() },
        { status: 500 }
      )
    }
    const { richMenuId: managerMenuId } = await managerCreateRes.json() as { richMenuId: string }

    // 4a. スタッフメニューを新規フォロワーのデフォルトに設定
    const setDefaultRes = await fetch(
      `https://api.line.me/v2/bot/richmenu/default/${staffMenuId}`,
      { method: 'POST', headers: authHeader }
    )

    // 4b. 既存の全フォロワーにスタッフメニューを紐付け
    const setAllRes = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${staffMenuId}`,
      { method: 'POST', headers: authHeader }
    )

    // 5. role=manager のスタッフに個別で経営者メニューを設定
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    const managerResults: { name: string; ok: boolean; status: number }[] = []
    for (const m of managers ?? []) {
      const res = await fetch(
        `https://api.line.me/v2/bot/user/${m.line_user_id}/richmenu/${managerMenuId}`,
        { method: 'POST', headers: authHeader }
      )
      managerResults.push({ name: m.name, ok: res.ok, status: res.status })
    }

    return NextResponse.json({
      ok: true,
      staff_menu_id:   staffMenuId,
      manager_menu_id: managerMenuId,
      set_default_ok:  setDefaultRes.ok,
      set_all_ok:      setAllRes.ok,
      managers_updated: managerResults,
      message: `セットアップ完了。スタッフ全員・経営者${managerResults.length}名に適用しました。`,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
