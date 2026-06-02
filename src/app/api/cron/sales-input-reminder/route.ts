export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/sales-input-reminder?phase=lunch|lunch_urgent|dinner|dinner_urgent
 * 昼/夜の締め時間に、手動入力が必要な売上の入力をLINEでリマインドする。
 * 規定時間に未入力なら「至急」の追いかけ通知を送る。
 *
 * 通知の方針:
 *   - エニテリ(店頭/AnyDeli)は自動更新済みである旨を必ず明記
 *   - スタッフが入力すべきもの（Uber/RocketNow）だけを依頼する
 *
 * Vercel Cron（JST）:
 *   15:00 → phase=lunch        （昼締めリマインド）
 *   15:30 → phase=lunch_urgent  （昼未確定なら至急）
 *   21:00 → phase=dinner        （夜締めリマインド）
 *   23:00 → phase=dinner_urgent （デリバリー未入力なら至急）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET
const BASE = 'https://goat-restaurant-os.vercel.app'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

function jstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  // Vercel Cron 認証（?secret= も許容）
  const auth = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const isAuthorized =
    !CRON_SECRET || auth === `Bearer ${CRON_SECRET}` || querySecret === CRON_SECRET
  if (!isAuthorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const phase = req.nextUrl.searchParams.get('phase') ?? 'lunch'
  const date = jstToday()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 当日の売上状態
  const { data: sales } = await db
    .from('daily_sales')
    .select('store_sales, lunch_confirmed_at, uber_sales, rocketnow_sales, uber_synced_at, rocketnow_synced_at')
    .eq('tenant_id', TENANT_ID)
    .eq('date', date)
    .maybeSingle()

  const storeSales       = Number(sales?.store_sales ?? 0)
  const lunchConfirmed   = sales?.lunch_confirmed_at != null
  // デリバリーが手動入力されたか（manual-delivery が synced_at をセットする）
  const deliveryEntered  = sales?.uber_synced_at != null || sales?.rocketnow_synced_at != null

  // 送信判定 + メッセージ生成
  let message: string | null = null

  if (phase === 'lunch') {
    if (!lunchConfirmed) {
      message =
        `☀️ 昼の締め時間です（15時）\n\n` +
        `✅ エニテリ（店頭）は自動更新済み：${yen(storeSales)}\n\n` +
        `📲 あなたが入力するのはこちら：\n` +
        `　Uber Eats / RocketNow の「昼分」の売上\n\n` +
        `売上ダッシュボードの「☀️昼を確定」から入力してください👇\n` +
        `${BASE}/staff-home/sales`
    }
  } else if (phase === 'lunch_urgent') {
    if (!lunchConfirmed) {
      message =
        `🚨 至急：昼の確定がまだです\n\n` +
        `✅ エニテリ（店頭 ${yen(storeSales)}）は自動更新済みです。\n` +
        `📲 Uber / RocketNow の「昼分」を入力して『昼を確定』してください👇\n` +
        `${BASE}/staff-home/sales`
    }
  } else if (phase === 'dinner') {
    if (!deliveryEntered) {
      message =
        `🌙 夜の締め時間です（21時）\n\n` +
        `✅ エニテリ（店頭）は自動更新済み：${yen(storeSales)}\n\n` +
        `📲 あなたが入力するのはこちら：\n` +
        `　Uber Eats / RocketNow の「1日の合計」売上（昼＋夜）\n\n` +
        `デリバリー売上入力から入力してください👇\n` +
        `${BASE}/staff-home/delivery-input`
    }
  } else if (phase === 'dinner_urgent') {
    if (!deliveryEntered) {
      message =
        `🚨 至急：デリバリー売上の入力がまだです\n\n` +
        `✅ エニテリ（店頭 ${yen(storeSales)}）は自動更新済みです。\n` +
        `📲 Uber / RocketNow の「1日の合計」を入力してください👇\n` +
        `${BASE}/staff-home/delivery-input`
    }
  } else {
    return NextResponse.json({ error: 'invalid phase' }, { status: 400 })
  }

  // 送る必要なし（既に入力済み等）
  if (!message) {
    return NextResponse.json({ ok: true, phase, skipped: true, reason: 'already_done' })
  }

  // 通知先: 当日出勤スタッフ + 経営者（重複排除）
  const [onDutyRes, managersRes] = await Promise.all([
    db.from('attendance')
      .select('staff_id, staff:staff_id(line_user_id, name)')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .not('clock_in', 'is', null),
    db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null),
  ])

  const recipients = new Map<string, string>() // line_user_id -> name
  for (const a of (onDutyRes.data ?? [])) {
    const s = a.staff
    if (s?.line_user_id) recipients.set(s.line_user_id, s.name ?? '')
  }
  for (const m of (managersRes.data ?? [])) {
    if (m.line_user_id) recipients.set(m.line_user_id, m.name ?? '')
  }

  const notified: string[] = []
  for (const [uid, name] of recipients) {
    try {
      await sendLineMessage(uid, message)
      notified.push(name || uid)
    } catch (e) {
      console.error('[sales-input-reminder] push失敗:', name, e)
    }
  }

  return NextResponse.json({ ok: true, phase, sent: notified.length, notified })
}
