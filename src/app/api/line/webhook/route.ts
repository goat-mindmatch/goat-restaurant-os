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
// TENANT_ID にはUUID（b78c555f-47c9-4552-bdaf-28656814c1f9）を直接設定
const TENANT_ID = process.env.TENANT_ID!

// 互換性のため関数形式を維持
async function getTenantId(): Promise<string> {
  return TENANT_ID
}

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
  const userId = event.source.userId

  // 友だち追加イベント → 登録フロー開始
  if (event.type === 'follow') {
    await handleFollow(userId)
    return
  }

  if (event.type !== 'message' || event.message.type !== 'text') return

  const text = event.message.text.trim()

  // 登録待ち状態かチェック（名前入力待ち）
  const isPending = await checkPendingRegistration(userId)
  if (isPending) {
    await handleNameInput(userId, text)
    return
  }

  // メニュー系のボタンが押されたら、古いセッションをクリア（詰まり防止）
  const MENU_KEYWORDS = ['出勤', '退勤', 'シフト希望提出', 'シフト確認', 'シフトボード', '発注依頼', '管理メニュー']
  if (MENU_KEYWORDS.includes(text)) {
    const sb = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('line_sessions').delete().eq('line_user_id', userId)
  } else {
    // メニュー以外 → シフト希望入力待ちチェック（旧テキスト式フロー用）
    const shiftSession = await getShiftSession(userId)
    if (shiftSession === 'awaiting_shift_dates') {
      await handleShiftDatesInput(userId, text)
      return
    }
  }

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
    case 'シフトボード':
      await handleShiftBoard(userId)
      break
    case '発注依頼':
      await sendLineMessage(userId, '発注依頼フォームを開きます。\n（Phase 2で実装予定）')
      break
    case '管理メニュー':
      await handleAdminMenu(userId)
      break
    default:
      await handleUnknownMessage(userId, text)
      break
  }
}

// ================================
// 友だち追加 → 登録フロー開始
// ================================
async function handleFollow(lineUserId: string) {
  const supabase = createServiceClient()

  // すでに登録済みか確認
  const { data: existing } = await supabase
    .from('staff')
    .select('id, name')
    .eq('tenant_id', await getTenantId())
    .eq('line_user_id', lineUserId)
    .single()

  const staff = existing as { id: string; name: string } | null

  if (staff) {
    await sendLineMessage(
      lineUserId,
      `おかえりなさい、${staff.name}さん！\n出勤・退勤ボタンからご利用ください。`
    )
    return
  }

  // 登録待ちセッションを作成
  await (supabase as any).from('line_sessions').upsert({
    line_user_id: lineUserId,
    state: 'awaiting_name',
    created_at: new Date().toISOString(),
  })

  await sendLineMessage(
    lineUserId,
    'はじめまして！\n人類みなまぜそば スタッフ用LINEです。\n\nお名前（名字のみ）を入力してください。\n例：「中地」'
  )
}

// ================================
// 登録待ち状態チェック
// ================================
async function checkPendingRegistration(lineUserId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('line_sessions')
    .select('state')
    .eq('line_user_id', lineUserId)
    .eq('state', 'awaiting_name')
    .single()
  return !!data
}

// ================================
// 名前入力 → LINE ID 登録
// ================================
async function handleNameInput(lineUserId: string, name: string) {
  const supabase = createServiceClient()

  // staffテーブルで名前照合
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, name')
    .eq('tenant_id', await getTenantId())
    .ilike('name', `%${name}%`)
    .single()

  const staff = staffData as { id: string; name: string } | null

  if (!staff) {
    await sendLineMessage(
      lineUserId,
      `「${name}」のスタッフ情報が見つかりませんでした。\n\n名字のみで入力してください（例：「中地」「河野」）\nそれでも見つからない場合は管理者に連絡してください。`
    )
    return
  }

  // LINE IDを登録
  await (supabase as any)
    .from('staff')
    .update({ line_user_id: lineUserId })
    .eq('id', staff.id)

  // セッション削除
  await (supabase as any)
    .from('line_sessions')
    .delete()
    .eq('line_user_id', lineUserId)

  await sendLineMessage(
    lineUserId,
    `✅ ${staff.name}さん、登録完了しました！\n\n出勤・退勤ボタンが使えるようになりました。\nよろしくお願いします！`
  )
}

// ================================
// 未登録ユーザーへのガイド
// ================================
async function handleUnknownMessage(lineUserId: string, _text: string) {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('staff')
    .select('id')
    .eq('tenant_id', await getTenantId())
    .eq('line_user_id', lineUserId)
    .single()

  if (!existing) {
    // 未登録 → 登録フローへ誘導
    await (supabase as any).from('line_sessions').upsert({
      line_user_id: lineUserId,
      state: 'awaiting_name',
      created_at: new Date().toISOString(),
    })
    await sendLineMessage(
      lineUserId,
      'まだ登録が完了していません。\nお名前（名字のみ）を入力してください。\n例：「中地」'
    )
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
    .eq('tenant_id', await getTenantId())
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
    tenant_id: await getTenantId(),
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
    .eq('tenant_id', await getTenantId())
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
// シフトセッション管理
// ================================
async function getShiftSession(lineUserId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('line_sessions')
    .select('state')
    .eq('line_user_id', lineUserId)
    .eq('state', 'awaiting_shift_dates')
    .single()
  return data ? data.state : null
}

// ================================
// シフト希望収集 開始
// ================================
async function handleShiftRequestStart(lineUserId: string) {
  const supabase = createServiceClient()

  // スタッフ確認
  const { data: staffData } = await supabase
    .from('staff').select('id, name')
    .eq('tenant_id', await getTenantId())
    .eq('line_user_id', lineUserId).single()
  const staff = staffData as { id: string; name: string } | null
  if (!staff) {
    await sendLineMessage(lineUserId, 'スタッフ登録が確認できませんでした。')
    return
  }

  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = nextMonth.getMonth() + 1

  // フォームURLを送信（チャットを使わずブラウザで完結）
  const formUrl = `https://goat-restaurant-os.vercel.app/shift-form?uid=${lineUserId}`

  await sendLineMessage(
    lineUserId,
    `📅 ${year}年${month}月のシフト希望フォームです。\n\nタップして開いてください👇\n${formUrl}\n\n日付ごとに出勤時間も指定できます。`
  )
}

// ================================
// シフト希望 日付入力処理
// ================================
async function handleShiftDatesInput(lineUserId: string, text: string) {
  const supabase = createServiceClient()

  // スタッフ確認
  const { data: staffData } = await supabase
    .from('staff').select('id, name')
    .eq('tenant_id', await getTenantId())
    .eq('line_user_id', lineUserId).single()
  const staff = staffData as { id: string; name: string } | null
  if (!staff) return

  // セッションからyear/month取得
  const { data: sessionData } = await (supabase as any)
    .from('line_sessions').select('meta')
    .eq('line_user_id', lineUserId)
    .eq('state', 'awaiting_shift_dates').single()

  const meta = sessionData?.meta ? JSON.parse(sessionData.meta) : null
  const now = new Date()
  const year = meta?.year ?? new Date(now.getFullYear(), now.getMonth() + 1, 1).getFullYear()
  const month = meta?.month ?? (now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2)
  const lastDay = new Date(year, month, 0).getDate()

  // 日付パース（「1,3,5」「1・3・5」「1 3 5」対応）
  const rawDates = text.split(/[,、・\s]+/).map(s => s.trim()).filter(Boolean)
  const validDates: string[] = []
  const invalidDates: string[] = []

  for (const d of rawDates) {
    const num = parseInt(d.replace(/日$/, ''))
    if (!isNaN(num) && num >= 1 && num <= lastDay) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(num).padStart(2,'0')}`
      validDates.push(dateStr)
    } else {
      invalidDates.push(d)
    }
  }

  if (validDates.length === 0) {
    await sendLineMessage(lineUserId,
      `日付が認識できませんでした。\n数字のみで入力してください。\n例：「1,3,5,8,10」`)
    return
  }

  // 保存（upsert）
  await (supabase as any).from('shift_requests').upsert({
    tenant_id: await getTenantId(),
    staff_id: staff.id,
    target_year: year,
    target_month: month,
    available_dates: validDates,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'staff_id,target_year,target_month' })

  // セッション削除
  await (supabase as any).from('line_sessions').delete()
    .eq('line_user_id', lineUserId)

  // 提出後のボードを表示
  const boardText = await buildShiftBoard(year, month)
  const dayNums = validDates.map(d => parseInt(d.split('-')[2])).sort((a,b) => a-b).join(', ')

  await sendLineMessage(lineUserId,
    `✅ ${staff.name}さんの${month}月シフト希望を受け付けました！\n\n提出日: ${dayNums}日\n\n【更新後の提出状況】\n${boardText}`)
}

// ================================
// シフトボード（全員の提出状況）
// ================================
async function buildShiftBoard(year: number, month: number): Promise<string> {
  const supabase = createServiceClient()
  const tenantId = await getTenantId()

  const { data: requests } = await (supabase as any)
    .from('shift_requests')
    .select('staff_id, available_dates, staff(name)')
    .eq('tenant_id', tenantId)
    .eq('target_year', year)
    .eq('target_month', month)

  if (!requests?.length) return '（まだ誰も提出していません）'

  // 日付ごとに誰が希望しているか集計
  const dayMap: Record<number, string[]> = {}
  const lastDay = new Date(year, month, 0).getDate()

  for (let d = 1; d <= lastDay; d++) {
    dayMap[d] = []
  }

  for (const req of requests) {
    const name = (req.staff as { name: string })?.name ?? '?'
    for (const dateStr of (req.available_dates as string[])) {
      const day = parseInt(dateStr.split('-')[2])
      if (dayMap[day] !== undefined) dayMap[day].push(name)
    }
  }

  // 誰かいる日だけ表示
  const DAYS_JP = ['日','月','火','水','木','金','土']
  const lines: string[] = []
  for (let d = 1; d <= lastDay; d++) {
    if (dayMap[d].length > 0) {
      const date = new Date(year, month - 1, d)
      const dow = DAYS_JP[date.getDay()]
      lines.push(`${month}/${d}(${dow}): ${dayMap[d].join('・')}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : '（まだ誰も提出していません）'
}

async function handleShiftBoard(lineUserId: string) {
  const now = new Date()
  // 来月のボードを表示
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = nextMonth.getMonth() + 1

  const boardText = await buildShiftBoard(year, month)
  await sendLineMessage(lineUserId,
    `📋 ${year}年${month}月 シフト希望状況\n\n${boardText}\n\n希望を出すには「シフト希望提出」ボタンを押してください。`)
}

async function handleShiftCheck(lineUserId: string) {
  const supabase = createServiceClient()

  const { data: staffData3 } = await supabase
    .from('staff')
    .select('id, name')
    .eq('tenant_id', await getTenantId())
    .eq('line_user_id', lineUserId)
    .single()

  const staff = staffData3 as { id: string; name: string } | null

  if (!staff) {
    await sendLineMessage(lineUserId, 'スタッフ登録が確認できませんでした。')
    return
  }

  // 今日以降のシフトを2ヶ月分取得（今月＋来月）
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const twoMonthsLater = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    .toISOString().split('T')[0]

  const { data: shiftsRaw } = await supabase
    .from('shifts')
    .select('date, start_time, end_time, role_on_day')
    .eq('staff_id', staff.id)
    .gte('date', today)
    .lte('date', twoMonthsLater)
    .order('date')

  const shifts = shiftsRaw as { date: string; start_time: string; end_time: string; role_on_day: string | null }[] | null

  if (!shifts?.length) {
    await sendLineMessage(lineUserId, `${staff.name}さん、今後のシフトはまだ確定していません。\n管理者にご確認ください。`)
    return
  }

  const DAYS_JP = ['日','月','火','水','木','金','土']
  const shiftText = shifts.map(s => {
    const d = new Date(s.date)
    const mm = d.getMonth() + 1
    const dd = d.getDate()
    const dow = DAYS_JP[d.getDay()]
    const role = s.role_on_day ? ` (${s.role_on_day})` : ''
    return `${mm}/${dd}(${dow}) ${s.start_time.slice(0,5)}〜${s.end_time.slice(0,5)}${role}`
  }).join('\n')

  await sendLineMessage(lineUserId, `📅 ${staff.name}さんの今後のシフト:\n\n${shiftText}\n\n全${shifts.length}日`)
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
