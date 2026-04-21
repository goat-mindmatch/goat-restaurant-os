export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/line/menu-inspect
 * LINEに今登録されているリッチメニューのボタン定義を人間が読める形で返す
 * 診断用エンドポイント
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'トークン未設定' }, { status: 500 })

  const h = { Authorization: `Bearer ${token}` }

  // 現在登録されているメニュー一覧（ボタン定義含む）
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: h })
  const listData = await listRes.json() as {
    richmenus?: {
      richMenuId: string
      name: string
      areas: {
        bounds: { x: number; y: number; width: number; height: number }
        action: { type: string; text?: string; uri?: string; label?: string }
      }[]
    }[]
  }

  // デフォルトメニュー
  const defRes = await fetch('https://api.line.me/v2/bot/richmenu/default', { headers: h })
  const defData = defRes.ok ? await defRes.json() as { richMenuId?: string } : {}

  const menus = (listData.richmenus ?? []).map(m => ({
    id: m.richMenuId,
    name: m.name,
    is_default: defData.richMenuId === m.richMenuId,
    buttons: m.areas.map((a, i) => ({
      position: i + 1,
      type: a.action.type,
      // messageボタンなら text、URIボタンなら uri を表示
      sends: a.action.type === 'message' ? a.action.text : a.action.uri,
      label: a.action.label,
    })),
  }))

  // 期待値
  const expected = {
    staff: {
      name: 'GOAT Staff Menu v4',
      buttons: [
        { position: 1, sends: '出勤' },
        { position: 2, sends: '退勤' },
        { position: 3, sends: 'シフト希望提出' },
        { position: 4, sends: '経営メニューへ切替' },
        { position: 5, sends: '自分のランク' },  // ← ここが「発注依頼」になっていると問題
        { position: 6, sends: 'シフト確認' },
      ],
    },
    manager: {
      name: 'GOAT Manager Menu v3',
      buttons: [
        { position: 1, sends: '本日の売上' },
        { position: 2, sends: 'https://goat-restaurant-os.vercel.app/dashboard/pl' },
        { position: 3, sends: 'https://goat-restaurant-os.vercel.app/dashboard/shifts' },
        { position: 4, sends: 'スタッフメニューへ切替' },
        { position: 5, sends: 'https://goat-restaurant-os.vercel.app/dashboard/rpg' },
        { position: 6, sends: 'https://goat-restaurant-os.vercel.app/dashboard' },
      ],
    },
  }

  // NG判定
  const issues: string[] = []
  for (const m of menus) {
    for (const b of m.buttons) {
      if (b.sends === '発注依頼') issues.push(`❌ [${m.name}] ボタン${b.position}: まだ「発注依頼」になっています`)
      if (b.sends?.includes('/dashboard/orders')) issues.push(`❌ [${m.name}] ボタン${b.position}: まだ発注管理URLが設定されています`)
    }
  }

  return NextResponse.json({
    summary: issues.length === 0 ? '✅ ボタン定義は正しいです（LINE側の問題なし）' : `⚠️ 問題あり: ${issues.join(' / ')}`,
    issues,
    current_menus: menus,
    expected,
    registered_menu_count: menus.length,
  })
}
