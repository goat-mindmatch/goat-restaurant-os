export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * LINE リッチメニュー自動セットアップ
 * POST /api/line/setup-richmenu
 *
 * スタッフ用（全員デフォルト）+ 経営者用（manager ロールに個別設定）の
 * 2種類を作成する
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const BASE_URL = 'https://goat-restaurant-os.vercel.app'
const TENANT_ID = process.env.TENANT_ID!

// ===========================
// スタッフ用リッチメニュー（6ボタン）
// ===========================
// ========================================
// 座標計算: 2500 × 1686 を 3×2 グリッドに分割
//   列幅: 834 + 833 + 833 = 2500  ✓
//   行高: 843 + 843       = 1686  ✓
// ========================================
const C = [0, 834, 1667]       // 各列の x 座標
const W = [834, 833, 833]       // 各列の幅
const R = [0, 843]              // 各行の y 座標
const H = 843                   // 行の高さ（共通）

const STAFF_RICH_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Staff Menu v3',
  chatBarText: 'スタッフメニュー',
  areas: [
    // 上段左: 出勤
    {
      bounds: { x: C[0], y: R[0], width: W[0], height: H },
      action: { type: 'message', label: '出勤打刻', text: '出勤' },
    },
    // 上段中: 退勤
    {
      bounds: { x: C[1], y: R[0], width: W[1], height: H },
      action: { type: 'message', label: '退勤打刻', text: '退勤' },
    },
    // 上段右: シフト希望提出
    {
      bounds: { x: C[2], y: R[0], width: W[2], height: H },
      action: {
        type: 'uri',
        label: 'シフト希望提出',
        uri: `${BASE_URL}/shift-form`,
      },
    },
    // 下段左: 口コミ誘導（お客様に見せる）
    {
      bounds: { x: C[0], y: R[1], width: W[0], height: H },
      action: {
        type: 'uri',
        label: '口コミを書く',
        uri: `${BASE_URL}/review`,
      },
    },
    // 下段中: 発注依頼
    {
      bounds: { x: C[1], y: R[1], width: W[1], height: H },
      action: {
        type: 'uri',
        label: '発注依頼',
        uri: `${BASE_URL}/order-form`,
      },
    },
    // 下段右: シフト確認
    {
      bounds: { x: C[2], y: R[1], width: W[2], height: H },
      action: { type: 'message', label: 'シフト確認', text: 'シフト確認' },
    },
  ],
}

// ===========================
// 経営者用リッチメニュー（6ボタン）
// ===========================
const MANAGER_RICH_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Manager Menu v2',
  chatBarText: '経営メニュー',
  areas: [
    // 上段左: 本日の売上確認
    {
      bounds: { x: C[0], y: R[0], width: W[0], height: H },
      action: { type: 'message', label: '売上確認', text: '本日の売上' },
    },
    // 上段中: PL・損益確認
    {
      bounds: { x: C[1], y: R[0], width: W[1], height: H },
      action: {
        type: 'uri',
        label: 'PL確認',
        uri: `${BASE_URL}/dashboard/pl`,
      },
    },
    // 上段右: シフト確認・修正
    {
      bounds: { x: C[2], y: R[0], width: W[2], height: H },
      action: {
        type: 'uri',
        label: 'シフト確認',
        uri: `${BASE_URL}/dashboard/shifts`,
      },
    },
    // 下段左: 人件費率リアルタイム
    {
      bounds: { x: C[0], y: R[1], width: W[0], height: H },
      action: { type: 'message', label: '人件費率', text: '人件費率' },
    },
    // 下段中: 発注状況確認
    {
      bounds: { x: C[1], y: R[1], width: W[1], height: H },
      action: {
        type: 'uri',
        label: '発注状況',
        uri: `${BASE_URL}/dashboard/orders`,
      },
    },
    // 下段右: スタッフ評価・ダッシュボード
    {
      bounds: { x: C[2], y: R[1], width: W[2], height: H },
      action: {
        type: 'uri',
        label: 'ダッシュボード',
        uri: `${BASE_URL}/dashboard`,
      },
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
    // 1. 既存リッチメニューを全削除
    const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers })
    if (listRes.ok) {
      const listData = await listRes.json() as { richmenus: { richMenuId: string }[] }
      await Promise.all(
        (listData.richmenus ?? []).map(menu =>
          fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
            method: 'DELETE', headers,
          })
        )
      )
    }

    // 2. スタッフ用リッチメニューを作成
    const staffCreateRes = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST', headers, body: JSON.stringify(STAFF_RICH_MENU),
    })
    if (!staffCreateRes.ok) {
      return NextResponse.json(
        { error: `スタッフメニュー作成失敗: ${staffCreateRes.status}`, detail: await staffCreateRes.text() },
        { status: 500 }
      )
    }
    const { richMenuId: staffMenuId } = await staffCreateRes.json() as { richMenuId: string }

    // 3. 経営者用リッチメニューを作成
    const managerCreateRes = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST', headers, body: JSON.stringify(MANAGER_RICH_MENU),
    })
    if (!managerCreateRes.ok) {
      return NextResponse.json(
        { error: `経営者メニュー作成失敗: ${managerCreateRes.status}`, detail: await managerCreateRes.text() },
        { status: 500 }
      )
    }
    const { richMenuId: managerMenuId } = await managerCreateRes.json() as { richMenuId: string }

    // 4a. スタッフメニューを「新規フォロワーのデフォルト」に設定
    const setDefaultRes = await fetch(
      `https://api.line.me/v2/bot/richmenu/default/${staffMenuId}`,
      { method: 'POST', headers }
    )
    const setDefaultOk = setDefaultRes.ok

    // 4b. 既存の全フォロワーにもスタッフメニューを紐付け
    const setAllRes = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${staffMenuId}`,
      { method: 'POST', headers }
    )
    const setAllOk = setAllRes.ok

    // 5. 経営者（role=manager）に個別でmanagerMenuを設定
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    const managerResults: { name: string; ok: boolean }[] = []
    for (const m of managers ?? []) {
      const res = await fetch(
        `https://api.line.me/v2/bot/user/${m.line_user_id}/richmenu/${managerMenuId}`,
        { method: 'POST', headers }
      )
      managerResults.push({ name: m.name, ok: res.ok })
    }

    return NextResponse.json({
      ok: true,
      staff_menu_id: staffMenuId,
      manager_menu_id: managerMenuId,
      set_default_ok: setDefaultOk,
      set_all_ok: setAllOk,
      managers_updated: managerResults,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
