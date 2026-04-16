export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * LINE Webhook エンドポイント（スタッフ用）
 * POST /api/line/webhook
 *
 * 対応メッセージ:
 * - "出勤"   → 打刻（出勤）
 * - "退勤"   → 打刻（退勤）
 * - "シフト希望提出" → シフト収集フロー開始
 * - "シフト確認"    → 今月のシフト表示
 * - "発注依頼"      → 発注依頼フロー開始
 * - "管理メニュー"  → 管理者パスワード確認
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage, sendQuickReply } from '@/lib/line-staff'

const CHANNEL_SECRET = process.env.LINE_STAFF_CHANNEL_SECRET!
const TENANT_ID = process.env.TENANT_ID!

// ================================
// 署名検証（LINE公式）
// ================================
function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64')
  return hash === signature
}

// ================================
// メインハンドラ
// ================================
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const events = body.events ?? []

  await Promise.all(events.map(handleEvent))

  return NextResponse.json({ ok: true })
}

// ================================
// イベント処理
// ================================
async function handleEvent(event: LineEvent) {
  if (event.type !== 'message' || event.message.type !== 'text') return

  const userId = event.source.userId
  const text = event.message.text.trim()

  switch (text) {
    case '出勤':
      await handleClockIn(userId)
      break
    case '退勤':
      await handleClockOut(userId)
      break
    case 'シフト希望提出':
      await handleShiftRequestStart(userId)
      break
    case 'シフト確認':
      await handleShiftCheck(userId)
      break
    case '発注依頼':
      await sendLineMessage(userId, '発注依頼フォームを開きます。\n（Phase 2で実装予定）')
      break
    case '管理メニュー':
      await handleAdminMenu(userId)
      break
    default:
      // 無視（特定フロー中の返答は別途セッション管理で対応）
      break
  }
}

// ================================
// 打刻: 出勤
// ================================
async function handleClockIn(lineUserId: string) {
  const supabase = createServiceClient()

  // LINE ID からスタッフ取得
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  const staff = staffData as { id: string; name: string } | null

  if (!staff) {
    await sendLineMessage(lineUserId, 'スタッフ登録が確認できませんでした。\n管理者に連絡してください。')
    return
  }

  const today = new Date().toISOString().split('T')[0]
  const nowTime = new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })

  // 既に打刻済みか確認
  const { data: existingRaw } = await supabase
    .from('attendance')
    .select('id, clock_in')
    .eq('staff_id', staff.id)
    .eq('date', today)
    .single()

  const existing = existingRaw as { id: string; clock_in: string | null } | null

  if (existing?.clock_in) {
    await sendLineMessage(lineUserId, `${staff.name}さん、本日はすでに出勤打刻済みです（${existing.clock_in}）。`)
    return
  }

  // 打刻保存
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('attendance') as any).upsert({
    tenant_id: TENANT_ID,
    staff_id: staff.id,
    date: today,
    clock_in: nowTime,
    recorded_via: 'line',
  })

  await sendLineMessage(lineUserId, `✅ ${staff.name}さん、出勤打刻しました！\n日時: ${today} ${nowTime}\n\nお疲れ様です。よろしくお願いします！`)
}

// ================================
// 打刻: 退勤
// ================================
async function handleClockOut(lineUserId: string) {
  const supabase = createServiceClient()

  const { data: staffData2 } = await supabase
    .from('staff')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  const staff = staffData2 as { id: string; name: string } | null

  if (!staff) {
    await sendLineMessage(lineUserId, 'スタッフ登録が確認できませんでした。\n管理者に連絡してください。')
    return
  }

  const today = new Date().toISOString().split('T')[0]
  const nowTime = new Date().toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })

  const { data: existingRaw2 } = await supabase
    .from('attendance')
    .select('id, clock_in, clock_out')
    .eq('staff_id', staff.id)
    .eq('date', today)
    .single()

  const existing2 = existingRaw2 as { id: string; clock_in: string | null; clock_out: string | null } | null

  if (!existing2?.clock_in) {
    await sendLineMessage(lineUserId, `${staff.name}さん、まだ出勤打刻がありません。\n先に「出勤」ボタンを押してください。`)
    return
  }

  if (existing2.clock_out) {
    await sendLineMessage(lineUserId, `${staff.name}さん、本日はすでに退勤打刻済みです（${existing2.clock_out}）。`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('attendance') as any).update({
    clock_out: nowTime,
  }).eq('id', existing2.id)

  await sendLineMessage(lineUserId, `✅ ${staff.name}さん、退勤打刻しました！\n退勤: ${nowTime}\n\nお疲れ様でした！ゆっくり休んでください😊`)
}

// ================================
// シフト希望収集
// ================================
async function handleShiftRequestStart(lineUserId: string) {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = nextMonth.getMonth() + 1

  await sendLineMessage(
    lineUserId,
    `📅 ${year}年${month}月のシフト希望を収集します。\n\n出勤できる日を「5/1,5/3,5/5」のようにカンマ区切りで送ってください。\n（例: 5/1,5/3,5/5,5/8）`
  )
  // TODO: セッション状態管理（Phase 1で簡易実装 → Redis or Supabase sessions table）
}

async function handleShiftCheck(lineUserId: string) {
  const supabase = createServiceClient()

  const { data: staffData3 } = await supabase
    .from('staff')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  const staff = staffData3 as { id: string; name: string } | null

  if (!staff) {
    await sendLineMessage(lineUserId, 'スタッフ登録が確認できませんでした。')
    return
  }

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: shiftsRaw } = await supabase
    .from('shifts')
    .select('date, start_time, end_time, role_on_day')
    .eq('staff_id', staff.id)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date')

  const shifts = shiftsRaw as { date: string; start_time: string; end_time: string; role_on_day: string | null }[] | null

  if (!shifts?.length) {
    await sendLineMessage(lineUserId, `${staff.name}さん、今月のシフトはまだ確定していません。\n管理者にご確認ください。`)
    return
  }

  const shiftText = shifts.map(s =>
    `${s.date.slice(5)} ${s.start_time.slice(0,5)}〜${s.end_time.slice(0,5)}${s.role_on_day ? ` (${s.role_on_day})` : ''}`
  ).join('\n')

  await sendLineMessage(lineUserId, `📅 ${staff.name}さんの今月シフト:\n\n${shiftText}`)
}

// ================================
// 管理メニュー（パスワード保護）
// ================================
async function handleAdminMenu(lineUserId: string) {
  await sendQuickReply(
    lineUserId,
    '管理メニューを開きます。\n管理者パスワードをテキストで送ってください。',
    [] // パスワード入力はテキストメッセージで受け取る
  )
}

// ================================
// 型定義
// ================================
type LineEvent = {
  type: string
  message: { type: string; text: string }
  source: { userId: string }
  replyToken: string
}
