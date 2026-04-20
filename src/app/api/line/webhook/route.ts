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
 * - [画像送信]      → レシートOCR → expenses テーブルに自動保存
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

  // 画像メッセージ → レシートOCR
  if (event.type === 'message' && event.message.type === 'image') {
    await handleReceiptImage(userId, event.message.id)
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
  const MENU_KEYWORDS = ['出勤', '退勤', 'シフト希望提出', 'シフト確認', 'シフトボード', '発注依頼', '管理メニュー', '口コミテスト', '口コミを書く', '書きました', '口コミ書きました', '完了', '検証', 'クーポン検証', 'クーポン', '本日の売上', '売上入力', 'スキル一覧', 'ヘルプ', '使い方', '経営メニューへ切替', 'スタッフメニューへ切替', 'メニュー更新', 'メニューリセット']
  if (MENU_KEYWORDS.includes(text)) {
    const sb = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('line_sessions').delete().eq('line_user_id', userId)
  } else {
    // 売上入力フロー（数字入力中）
    const salesSession = await getSalesSession(userId)
    if (salesSession) {
      await handleSalesInput(userId, text, salesSession)
      return
    }
    // シフト希望入力待ちチェック
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
      await sendLineMessage(userId,
        `📦 発注依頼フォームです。\n\nタップして開いてください👇\nhttps://goat-restaurant-os.vercel.app/order-form?uid=${userId}\n\n品目・数量・配達希望日を入力できます。`)
      break
    case '口コミテスト':
    case '口コミを書く':
      await sendLineMessage(userId,
        `⭐ 口コミテスト用フォームです。\n\n※本番は顧客用LINEから届きます。\nタップしてテストしてください👇\nhttps://goat-restaurant-os.vercel.app/review?uid=${userId}\n\nスタッフを選ぶ → Googleで口コミを書く → LINEに戻って「書きました」と送信してください。`)
      break
    case '書きました':
    case '口コミ書きました':
    case '完了':
      await handleReviewCompleted(userId)
      break
    case '検証':
    case 'クーポン検証':
    case 'クーポン':
      await sendLineMessage(userId,
        `🔍 クーポン検証ページです。\n\nお客様の検証コードを入力して承認してください👇\nhttps://goat-restaurant-os.vercel.app/verify?uid=${userId}\n\n💡 ブックマークしておくと便利です。`)
      break
    case '本日の売上':
      await handleTodaySales(userId)
      break
    case '売上入力':
      await handleSalesInputStart(userId)
      break
    case 'スキル一覧':
    case 'ヘルプ':
    case '使い方':
      await handleSkillList(userId)
      break
    case '経営メニューへ切替':
      await handleMenuSwitch(userId, 'manager')
      break
    case 'スタッフメニューへ切替':
      await handleMenuSwitch(userId, 'staff')
      break
    case 'メニュー更新':
    case 'メニューリセット':
      await handleMenuReset(userId)
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
    .select('staff_id, available_dates, staff:staff!reviews_staff_id_fkey(name)')
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

// ================================
// 口コミ完了報告（「書きました」受信時）
// ================================
async function handleReviewCompleted(lineUserId: string) {
  const supabase = createServiceClient()

  // 直近24時間以内の未完了クリックを探す
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: reviewRaw } = await (supabase as any)
    .from('reviews')
    .select('id, staff_id, staff:staff!reviews_staff_id_fkey(name), completed, clicked_at')
    .eq('customer_line_user_id', lineUserId)
    .eq('completed', false)
    .gte('clicked_at', since)
    .order('clicked_at', { ascending: false })
    .limit(1)
    .single()

  const review = reviewRaw as {
    id: string
    staff_id: string | null
    staff: { name: string } | null
    completed: boolean
  } | null

  if (!review) {
    await sendLineMessage(lineUserId,
      `⚠️ 直近の口コミ誘導が見つかりませんでした。\n\n「⭐口コミを書く」から始めて、Googleで投稿後に「書きました」と送ってください。`)
    return
  }

  // 完了フラグを立てる
  await (supabase as any).from('reviews')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', review.id)

  const staffName = review.staff?.name ?? '指名なし'
  await sendLineMessage(lineUserId,
    `🎉 口コミのご協力ありがとうございました！\n\n${staffName}${review.staff?.name ? 'さんの接客' : ''}として記録しました。\n\n皆様の声が私たちの励みになります。\nまたのご来店をお待ちしております🙌`)
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
// レシートOCR（画像 → Claude Vision → expenses保存）
// ================================
async function handleReceiptImage(lineUserId: string, messageId: string) {
  // スタッフ確認
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data: staff } = await db.from('staff')
    .select('id, name').eq('line_user_id', lineUserId).eq('tenant_id', TENANT_ID).single()

  if (!staff) {
    await sendLineMessage(lineUserId, 'スタッフ登録が必要です。まず登録を完了してください。')
    return
  }

  await sendLineMessage(lineUserId, '📷 レシートを読み取り中です...')

  try {
    // LINE Content API からバイナリ画像を取得
    const lineToken = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN!
    const contentRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken}` },
    })
    if (!contentRes.ok) throw new Error('LINE画像取得失敗')

    const imageBuffer = await contentRes.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const contentType = contentRes.headers.get('content-type') ?? 'image/jpeg'

    // Claude Vision でレシート情報を抽出
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const today = new Date().toISOString().split('T')[0]

    const extraction = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64Image },
          },
          {
            type: 'text',
            text: `このレシート・領収書から以下の情報をJSON形式で抽出してください。
不明な項目はnullにしてください。

{
  "date": "YYYY-MM-DD形式の日付（不明なら今日: ${today}）",
  "vendor": "店名・業者名",
  "amount": 税込合計金額（数値のみ、円記号なし）,
  "tax_amount": 消費税額（数値のみ、不明なら0）,
  "category": "food/utility/consumable/equipment/rent/communication/other のいずれか",
  "note": "品目の簡単なメモ（最大30文字）"
}

categoryの判定基準:
- food: 食材・仕入れ・飲食
- utility: 電気・ガス・水道
- consumable: 消耗品（容器・袋・洗剤等）
- equipment: 設備・厨房機器
- rent: 家賃
- communication: 通信・電話
- other: その他

JSONのみを返してください。前後の説明は不要です。`,
          },
        ],
      }],
    })

    const rawText = extraction.content[0].type === 'text' ? extraction.content[0].text.trim() : ''
    // コードブロック除去
    const jsonText = rawText.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim()
    const extracted = JSON.parse(jsonText)

    // Supabase Storage に画像をアップロード
    let receiptUrl: string | null = null
    try {
      const storageClient = createServiceClient()
      const ext = contentType.includes('png') ? 'png' : 'jpg'
      const monthStr = (extracted.date ?? today).slice(0, 7)
      const filePath = `${TENANT_ID}/${monthStr}/${messageId}.${ext}`
      const { error: uploadError } = await storageClient.storage
        .from('receipts')
        .upload(filePath, Buffer.from(imageBuffer), {
          contentType,
          upsert: true,
        })
      if (!uploadError) {
        const { data: { publicUrl } } = storageClient.storage
          .from('receipts')
          .getPublicUrl(filePath)
        receiptUrl = publicUrl
      }
    } catch {
      // 画像保存失敗はOCR結果に影響させない
    }

    // expenses に保存
    const { data: expense, error } = await db.from('expenses').insert({
      tenant_id: TENANT_ID,
      date: extracted.date ?? today,
      category: extracted.category ?? 'other',
      vendor: extracted.vendor ?? null,
      amount: Number(extracted.amount ?? 0),
      tax_amount: Number(extracted.tax_amount ?? 0),
      note: extracted.note ?? null,
      ai_extracted: true,
      recorded_by: staff.id,
      receipt_url: receiptUrl,
    }).select().single()

    if (error) throw error

    const CATEGORY_LABELS: Record<string, string> = {
      food: '食材費', utility: '光熱費', consumable: '消耗品',
      equipment: '設備費', rent: '家賃', communication: '通信費', other: 'その他',
    }
    const catLabel = CATEGORY_LABELS[expense.category] ?? expense.category

    await sendLineMessage(
      lineUserId,
      `✅ レシートをPLに記録しました！\n\n` +
      `📅 日付: ${expense.date}\n` +
      `🏪 ${expense.vendor ?? '（店名不明）'}\n` +
      `💴 ¥${Number(expense.amount).toLocaleString()}\n` +
      `📂 カテゴリ: ${catLabel}\n` +
      (expense.note ? `📝 ${expense.note}\n` : '') +
      `\n内容が違う場合はダッシュボードで修正できます。`
    )
  } catch (e) {
    console.error('Receipt OCR error:', e)
    await sendLineMessage(
      lineUserId,
      '⚠️ レシードの読み取りに失敗しました。\n再度送信するか、手動でダッシュボードから入力してください。'
    )
  }
}

// ================================
// リッチメニュー強制リセット（ユーザー単位）
// ================================
async function handleMenuReset(lineUserId: string) {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN!
  const h = { Authorization: `Bearer ${token}` }

  // 1. 現在のメニューリンクを解除
  await fetch(
    `https://api.line.me/v2/bot/user/${lineUserId}/richmenu`,
    { method: 'DELETE', headers: h }
  )

  // 2. スタッフメニューIDを取得
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: h })
  if (!listRes.ok) {
    await sendLineMessage(lineUserId, '⚠️ メニューのリセットに失敗しました。')
    return
  }
  const listData = await listRes.json() as { richmenus: { richMenuId: string; name: string }[] }

  // roleに応じてスタッフ or 経営者メニューを選択
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data: staff } = await db.from('staff')
    .select('name, role').eq('tenant_id', TENANT_ID).eq('line_user_id', lineUserId).single()

  const isManager = staff?.role === 'manager'
  const targetName = isManager ? 'GOAT Manager Menu v2' : 'GOAT Staff Menu v3'
  const targetMenu = listData.richmenus.find(m => m.name === targetName)

  if (!targetMenu) {
    await sendLineMessage(lineUserId, '⚠️ メニューが見つかりません。管理者に設定を依頼してください。')
    return
  }

  // 3. 再リンク
  await fetch(
    `https://api.line.me/v2/bot/user/${lineUserId}/richmenu/${targetMenu.richMenuId}`,
    { method: 'POST', headers: h }
  )

  const label = isManager ? '経営者' : 'スタッフ'
  await sendLineMessage(lineUserId,
    `✅ ${label}メニューをリセットしました！\nLINEを完全に閉じて（ホーム画面でアプリを上にスワイプ）\nもう一度開いてください。`)
}

// ================================
// リッチメニュー切り替え
// ================================
async function handleMenuSwitch(lineUserId: string, to: 'staff' | 'manager') {
  const token = process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN!
  // ボディなしPOSTにはAuthorizationのみ
  const h = { Authorization: `Bearer ${token}` }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // ユーザーのroleを確認
  const { data: staff } = await db.from('staff')
    .select('name, role')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  // 経営者以外が「経営メニューへ」を押した場合は弾く
  if (to === 'manager' && staff?.role !== 'manager') {
    await sendLineMessage(lineUserId,
      '⚠️ このメニューは経営者専用です。\nご不明な場合は管理者にお問い合わせください。')
    return
  }

  // メニュー一覧からIDを取得
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: h })
  if (!listRes.ok) {
    await sendLineMessage(lineUserId, '⚠️ メニューの切り替えに失敗しました。')
    return
  }
  const listData = await listRes.json() as { richmenus: { richMenuId: string; name: string }[] }
  const menus = listData.richmenus ?? []

  const targetName = to === 'manager' ? 'GOAT Manager Menu v2' : 'GOAT Staff Menu v3'
  const targetMenu = menus.find(m => m.name === targetName)

  if (!targetMenu) {
    await sendLineMessage(lineUserId, '⚠️ メニューが見つかりませんでした。管理者に設定を依頼してください。')
    return
  }

  // 個人のメニューを切り替え
  const switchRes = await fetch(
    `https://api.line.me/v2/bot/user/${lineUserId}/richmenu/${targetMenu.richMenuId}`,
    { method: 'POST', headers: h }
  )

  if (switchRes.ok) {
    const label = to === 'manager' ? '経営者' : 'スタッフ'
    const name = staff?.name ? `${staff.name}さん、` : ''
    await sendLineMessage(lineUserId,
      `✅ ${name}${label}メニューに切り替えました！\nLINEを一度閉じて開き直すと反映されます。`)
  } else {
    await sendLineMessage(lineUserId, '⚠️ メニューの切り替えに失敗しました。時間をおいて再度お試しください。')
  }
}

// ================================
// 本日の売上（経営者向け）
// ================================
async function handleTodaySales(lineUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // role確認（経営者のみ）
  const { data: staff } = await db.from('staff')
    .select('name, role')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  if (!staff || staff.role !== 'manager') {
    await sendLineMessage(lineUserId, '⚠️ このコマンドは経営者専用です。')
    return
  }

  const today = new Date().toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-')
  const todayISO = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    .toISOString().split('T')[0]

  const { data: sales } = await db.from('daily_sales')
    .select('total_sales, store_sales, delivery_sales, store_orders, delivery_orders, uber_sales, rocketnow_sales, lunch_sales, dinner_sales, food_cost, labor_cost')
    .eq('tenant_id', TENANT_ID)
    .eq('date', todayISO)
    .single()

  // 月次集計
  const firstDayOfMonth = todayISO.slice(0, 7) + '-01'
  const { data: monthRows } = await db.from('daily_sales')
    .select('total_sales')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDayOfMonth)
    .lte('date', todayISO)
  const monthTotal = (monthRows ?? []).reduce((s: number, r: { total_sales: number | null }) => s + (r.total_sales ?? 0), 0)

  // 月間目標
  const { data: tenant } = await db.from('tenants')
    .select('monthly_target').eq('id', TENANT_ID).single()
  const monthlyTarget = tenant?.monthly_target ?? 0

  if (!sales) {
    await sendLineMessage(lineUserId,
      `📊 ${today} の売上\n\nまだ売上データが入力されていません。\n\nダッシュボードから入力してください👇\nhttps://goat-restaurant-os.vercel.app/dashboard/sales`)
    return
  }

  const fmt = (n: number | null) => n != null ? `¥${n.toLocaleString()}` : '未入力'
  const pct = (a: number | null, b: number) => (a && b > 0) ? ` (${Math.round(a / b * 100)}%)` : ''

  const flLine = (sales.food_cost || sales.labor_cost)
    ? `\n💰 FL比率: 食材 ${fmt(sales.food_cost)} / 人件費 ${fmt(sales.labor_cost)}`
    : ''

  const monthLine = monthlyTarget > 0
    ? `\n\n📅 今月累計: ${fmt(monthTotal)}${pct(monthTotal, monthlyTarget)} / 目標 ${fmt(monthlyTarget)}`
    : `\n\n📅 今月累計: ${fmt(monthTotal)}`

  await sendLineMessage(lineUserId,
    `📊 ${today} の売上\n\n` +
    `💴 合計: ${fmt(sales.total_sales)}\n` +
    `🏪 店内: ${fmt(sales.store_sales)}（${sales.store_orders ?? 0}件）\n` +
    `🛵 デリバリー: ${fmt(sales.delivery_sales)}（${sales.delivery_orders ?? 0}件）\n` +
    (sales.lunch_sales ? `🌞 ランチ: ${fmt(sales.lunch_sales)}\n` : '') +
    (sales.dinner_sales ? `🌙 ディナー: ${fmt(sales.dinner_sales)}\n` : '') +
    flLine +
    monthLine +
    `\n\n詳細はダッシュボードで確認できます👇\nhttps://goat-restaurant-os.vercel.app/dashboard`
  )
}

// ================================
// 売上入力フロー（経営者向け）
// ================================

type SalesMeta = {
  date: string
  store_sales?: number
  uber_sales?: number
  rocketnow_sales?: number
}

// セッション取得
async function getSalesSession(lineUserId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data } = await db.from('line_sessions')
    .select('state')
    .eq('line_user_id', lineUserId)
    .in('state', ['awaiting_sales_store', 'awaiting_sales_uber', 'awaiting_sales_rocketnow'])
    .single()
  return data ? data.state : null
}

// フロー開始（フォームURLを送信）
async function handleSalesInputStart(lineUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 経営者チェック
  const { data: staff } = await db.from('staff')
    .select('name, role').eq('tenant_id', TENANT_ID).eq('line_user_id', lineUserId).single()
  if (!staff || staff.role !== 'manager') {
    await sendLineMessage(lineUserId, '⚠️ このコマンドは経営者専用です。')
    return
  }

  const formUrl = `https://goat-restaurant-os.vercel.app/sales-form?uid=${lineUserId}`
  await sendLineMessage(lineUserId,
    `📝 売上入力フォームです。\n\nタップして開いてください👇\n${formUrl}\n\n店内・Uber・ロケットなう・食材費をまとめて入力できます。`)
}

// 数値入力処理
async function handleSalesInput(lineUserId: string, text: string, state: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  if (text === 'キャンセル') {
    await db.from('line_sessions').delete().eq('line_user_id', lineUserId)
    await sendLineMessage(lineUserId, '❌ 売上入力をキャンセルしました。')
    return
  }

  // 数字以外はエラー
  const num = parseInt(text.replace(/[,，¥￥円]/g, ''), 10)
  if (isNaN(num) || num < 0) {
    await sendLineMessage(lineUserId,
      '⚠️ 数字で入力してください（例：85000）\nキャンセルは「キャンセル」')
    return
  }

  // セッションからmeta取得
  const { data: sessionData } = await db.from('line_sessions')
    .select('meta').eq('line_user_id', lineUserId).single()
  const meta: SalesMeta = sessionData?.meta ? JSON.parse(sessionData.meta) : { date: new Date().toISOString().split('T')[0] }

  if (state === 'awaiting_sales_store') {
    meta.store_sales = num
    await db.from('line_sessions').update({
      state: 'awaiting_sales_uber',
      meta: JSON.stringify(meta),
    }).eq('line_user_id', lineUserId)

    await sendLineMessage(lineUserId,
      `✅ 店内売上：¥${num.toLocaleString()}\n\n` +
      `━━━━━━━━━━━━\n` +
      `②Uber Eats売上（円）は？\n\n` +
      `例：32000\nなければ「0」\n` +
      `━━━━━━━━━━━━`)

  } else if (state === 'awaiting_sales_uber') {
    meta.uber_sales = num
    await db.from('line_sessions').update({
      state: 'awaiting_sales_rocketnow',
      meta: JSON.stringify(meta),
    }).eq('line_user_id', lineUserId)

    await sendLineMessage(lineUserId,
      `✅ Uber Eats：¥${num.toLocaleString()}\n\n` +
      `━━━━━━━━━━━━\n` +
      `③ロケットなう売上（円）は？\n\n` +
      `例：12000\nなければ「0」\n` +
      `━━━━━━━━━━━━`)

  } else if (state === 'awaiting_sales_rocketnow') {
    meta.rocketnow_sales = num

    // セッション削除
    await db.from('line_sessions').delete().eq('line_user_id', lineUserId)

    // 集計
    const storeSales     = meta.store_sales     ?? 0
    const uberSales      = meta.uber_sales      ?? 0
    const rocketnowSales = meta.rocketnow_sales ?? 0
    const deliverySales  = uberSales + rocketnowSales
    const totalSales     = storeSales + deliverySales

    // daily_sales に保存
    const { error } = await db.from('daily_sales').upsert({
      tenant_id:        TENANT_ID,
      date:             meta.date,
      store_sales:      storeSales,
      uber_sales:       uberSales,
      rocketnow_sales:  rocketnowSales,
      delivery_sales:   deliverySales,
      total_sales:      totalSales,
      data_source:      'line',
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'tenant_id,date' })

    if (error) {
      await sendLineMessage(lineUserId, `⚠️ 保存に失敗しました。\n${error.message}`)
      return
    }

    const dateLabel = meta.date.replace(/-/g, '/').slice(5)
    await sendLineMessage(lineUserId,
      `✅ ${dateLabel}の売上を保存しました！\n\n` +
      `━━━━━━━━━━━━\n` +
      `🏪 店内：¥${storeSales.toLocaleString()}\n` +
      `🛵 Uber：¥${uberSales.toLocaleString()}\n` +
      `🚀 ロケットなう：¥${rocketnowSales.toLocaleString()}\n` +
      `━━━━━━━━━━━━\n` +
      `💴 合計：¥${totalSales.toLocaleString()}\n\n` +
      `ダッシュボードに反映されました👇\nhttps://goat-restaurant-os.vercel.app/dashboard`)
  }
}

// ================================
// スキル一覧（全機能の使い方ガイド）
// ================================
async function handleSkillList(lineUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data: staff } = await db.from('staff')
    .select('role').eq('tenant_id', TENANT_ID).eq('line_user_id', lineUserId).single()

  const isManager = staff?.role === 'manager'

  // リッチメニュー外の隠し機能だけを案内
  const staffSkills =
    `💡 メニューにない隠し機能\n\n` +
    `━━━━━━━━━━━━\n` +
    `🧾 領収書・レシートの自動記録\n` +
    `レシートの写真をこのトーク画面に送るだけで、AIが金額・店名・カテゴリを読み取ってPL（損益表）に自動登録されます。\n\n` +
    `🔄 メニューの表示がおかしいとき\n` +
    `「メニューリセット」と送信 → 正しいメニューに戻ります\n\n` +
    `━━━━━━━━━━━━\n` +
    `「スキル一覧」でいつでもこの案内を表示できます`

  const managerSkills =
    `💡 経営者向け 追加の隠し機能\n\n` +
    `━━━━━━━━━━━━\n` +
    `📝 売上入力フォーム\n` +
    `「売上入力」と送信 → フォームが開く\n` +
    `店内・Uber Eats・ロケットなう・食材費をまとめて入力できます\n` +
    `（リッチメニューの「売上確認」は確認専用です）\n\n` +
    `━━━━━━━━━━━━\n` +
    `上記以外の機能はメニューボタンからご利用ください`

  await sendLineMessage(lineUserId, staffSkills)
  if (isManager) {
    await sendLineMessage(lineUserId, managerSkills)
  }
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
  message: { type: string; text: string; id: string }
  source: { userId: string }
  replyToken: string
}
