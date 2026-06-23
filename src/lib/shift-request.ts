/**
 * シフト希望提出依頼の一斉配信ロジック（共通）
 * - 毎月20日のcron（/api/cron/shift-request）と
 *   手動配信ボタン（/api/shifts/request-broadcast）の両方から使う。
 * - cronが不発でも管理画面のボタンから手動で送れるようにする。
 */

import { sendLineMessage } from '@/lib/line-staff'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://goat-restaurant-os.vercel.app'

export type ShiftRequestResult = {
  ok: boolean
  year: number
  month: number
  deadlineMonth: number
  deadlineDay: number
  sent: number
  total: number
  errors: string[]
}

/**
 * 翌月のシフト希望提出依頼を、LINE登録済みのアクティブスタッフ全員に送信する。
 * @param db service role の Supabase クライアント
 * @param tenantId テナントID
 * @param opts.notifyManagers 管理者に完了通知を送るか（既定 true）
 */
export async function sendShiftRequestBroadcast(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  tenantId: string,
  opts?: { notifyManagers?: boolean }
): Promise<ShiftRequestResult> {
  const now = new Date()
  // JST基準で「今月」「翌月」を計算（UTC+9）
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const nextMonth = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 1, 1))
  const year = nextMonth.getUTCFullYear()
  const month = nextMonth.getUTCMonth() + 1
  const deadlineMonth = jst.getUTCMonth() + 1 // 今月
  const deadlineDay = 25

  const { data: staffList } = await db
    .from('staff')
    .select('id, name, line_user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .not('line_user_id', 'is', null)

  const list = (staffList ?? []) as Array<{ id: string; name: string; line_user_id: string }>

  let sent = 0
  const errors: string[] = []

  for (const staff of list) {
    const shiftFormUrl = `${BASE_URL}/shift-form?uid=${staff.line_user_id}`
    const message =
      `📅 ${staff.name}さん、こんにちは！\n\n` +
      `${year}年${month}月のシフト希望提出の時期になりました。\n\n` +
      `以下のリンクから、出勤できる日・優先したい日を選んで送信してください。\n\n` +
      `👉 ${shiftFormUrl}\n\n` +
      `⏰ 提出期限: ${deadlineMonth}月${deadlineDay}日（今月）\n\n` +
      `期限までに提出がない場合、シフトに入れない可能性があります。よろしくお願いします！`
    try {
      await sendLineMessage(staff.line_user_id, message)
      sent++
    } catch (e) {
      errors.push(`${staff.name}: ${(e as Error).message}`)
    }
  }

  // 管理者に完了通知
  if (opts?.notifyManagers !== false) {
    try {
      const { data: managers } = await db
        .from('staff')
        .select('line_user_id, name')
        .eq('tenant_id', tenantId)
        .eq('role', 'manager')
        .eq('is_active', true)
        .not('line_user_id', 'is', null)
      for (const m of (managers ?? []) as Array<{ line_user_id: string }>) {
        await sendLineMessage(
          m.line_user_id,
          `✅ ${year}年${month}月のシフト希望収集メッセージを送信しました\n\n` +
          `対象: ${sent}名\n` +
          `提出期限: ${deadlineMonth}月${deadlineDay}日` +
          (errors.length > 0 ? `\n\n⚠️ 送信失敗:\n${errors.join('\n')}` : '')
        ).catch(() => {})
      }
    } catch { /* 通知失敗は無視 */ }
  }

  return { ok: true, year, month, deadlineMonth, deadlineDay, sent, total: list.length, errors }
}
