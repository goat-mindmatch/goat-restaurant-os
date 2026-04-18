export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/shift-request
 * Vercel Cronから毎月20日 9:00 JST（00:00 UTC）に呼ばれる
 * - 翌月のシフト希望提出依頼を全スタッフのLINEに自動送信
 * - LINE: リッチメニュー「シフト希望提出」ボタンのURLが /shift-form?uid={userId}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://goat-restaurant-os.vercel.app'

export async function GET(req: NextRequest) {
  // Vercel Cron の認証
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    // 翌月の年・月を計算
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const year = nextMonth.getFullYear()
    const month = nextMonth.getMonth() + 1
    const deadline = 25 // 提出期限（翌月25日まで）

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // LINE登録済のアクティブスタッフを全員取得
    const { data: staffList } = await db
      .from('staff')
      .select('id, name, line_user_id')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    if (!staffList || staffList.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'スタッフなし' })
    }

    let sentCount = 0
    const errors: string[] = []

    for (const staff of staffList) {
      const shiftFormUrl = `${BASE_URL}/shift-form?uid=${staff.line_user_id}`

      const message =
        `📅 ${staff.name}さん、こんにちは！\n\n` +
        `${year}年${month}月のシフト希望提出の時期になりました。\n\n` +
        `以下のリンクから、出勤できる日・優先したい日を選んで送信してください。\n\n` +
        `👉 ${shiftFormUrl}\n\n` +
        `⏰ 提出期限: ${now.getMonth() + 1}月${deadline}日（今月）\n\n` +
        `期限までに提出がない場合、シフトに入れない可能性があります。よろしくお願いします！`

      try {
        await sendLineMessage(staff.line_user_id, message)
        sentCount++
      } catch (e) {
        errors.push(`${staff.name}: ${(e as Error).message}`)
      }
    }

    // 管理者にも送信完了通知
    try {
      const { data: managers } = await db
        .from('staff')
        .select('line_user_id, name')
        .eq('tenant_id', TENANT_ID)
        .eq('role', 'manager')
        .eq('is_active', true)
        .not('line_user_id', 'is', null)

      for (const m of managers ?? []) {
        await sendLineMessage(
          m.line_user_id,
          `✅ ${year}年${month}月のシフト希望収集メッセージを送信しました\n\n` +
          `対象: ${sentCount}名\n` +
          `提出期限: ${now.getMonth() + 1}月${deadline}日\n` +
          (errors.length > 0 ? `\n⚠️ 送信失敗:\n${errors.join('\n')}` : '')
        ).catch(() => {})
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      year,
      month,
      sent: sentCount,
      total: staffList.length,
      errors,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
