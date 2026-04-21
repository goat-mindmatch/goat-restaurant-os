export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/line/debug
 * LINE チャンネルの完全診断:
 * - Bot情報（どのアカウントのトークンか）
 * - リッチメニュー一覧と画像有無
 * - デフォルト設定状態
 * - フォロワー数
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'LINE_STAFF_CHANNEL_ACCESS_TOKEN 未設定' }, { status: 500 })
  }

  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const results: Record<string, unknown> = {
    // Content-Typeヘッダーバグ修正済み確認用
    _note: 'ボディなしPOSTはAuthorizationのみ使用（Content-Type除去済み）',
  }

  // 1. Bot情報（どのLINEアカウントのトークンか）
  try {
    const r = await fetch('https://api.line.me/v2/bot/info', { headers: h })
    results.bot_info = await r.json()
    results.bot_info_status = r.status
  } catch (e) { results.bot_info_error = String(e) }

  // 2. リッチメニュー一覧
  try {
    const r = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: h })
    const data = await r.json() as { richmenus?: { richMenuId: string; name: string; selected: boolean }[] }
    results.richmenu_list_status = r.status
    results.richmenu_count = (data.richmenus ?? []).length
    results.richmenus = data.richmenus ?? []
  } catch (e) { results.richmenu_list_error = String(e) }

  // 3. デフォルトリッチメニュー
  try {
    const r = await fetch('https://api.line.me/v2/bot/richmenu/default', { headers: h })
    results.default_richmenu_status = r.status
    results.default_richmenu = r.ok ? await r.json() : await r.text()
  } catch (e) { results.default_richmenu_error = String(e) }

  // 4. チャンネルのフォロワー数
  try {
    const r = await fetch('https://api.line.me/v2/bot/followers/count', { headers: h })
    results.followers_status = r.status
    results.followers = r.ok ? await r.json() : await r.text()
  } catch (e) { results.followers_error = String(e) }

  // 5. 各リッチメニューの画像確認 + デフォルト設定のテスト
  const menus = (results.richmenus as { richMenuId: string; name: string }[]) ?? []
  const imageChecks: Record<string, unknown>[] = []
  for (const m of menus) {
    const imgR = await fetch(
      `https://api-data.line.me/v2/bot/richmenu/${m.richMenuId}/content`,
      { headers: h }
    )
    imageChecks.push({
      name: m.name,
      id: m.richMenuId,
      image_status: imgR.status,
      has_image: imgR.ok,
      content_type: imgR.headers.get('content-type'),
    })
  }
  results.image_checks = imageChecks

  // 6. Webhook設定確認
  try {
    const r = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', { headers: h })
    results.webhook_status = r.status
    results.webhook_info   = r.ok ? await r.json() : await r.text()
  } catch (e) { results.webhook_error = String(e) }

  // ※ 以前あったPOSTテスト（全員適用）は削除済み
  // 診断エンドポイントがメニューを上書きするバグを防ぐため、読み取り専用にした

  return NextResponse.json(results, { status: 200 })
}
