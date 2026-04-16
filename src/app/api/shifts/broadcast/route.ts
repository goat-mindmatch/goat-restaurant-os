export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/shifts/broadcast
 * 指定月の確定シフトを各スタッフにLINEで個別送信
 * body: { year, month }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

export async function POST(req: NextRequest) {
  try {
    const { year, month } = await req.json()
    if (!year || !month) {
      return NextResponse.json({ error: 'year/month required' }, { status: 400 })
    }

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDayNum = new Date(year, month, 0).getDate()
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 全スタッフ取得（LINE登録済のみ）
    const { data: staffList } = await db
      .from('staff')
      .select('id, name, line_user_id')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    // 月内の全シフトを取得
    const { data: shifts } = await db
      .from('shifts')
      .select('staff_id, date, start_time, end_time, role_on_day')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date')

    // スタッフごとにシフトをグループ化
    const shiftsByStaff = new Map<string, typeof shifts>()
    for (const s of shifts ?? []) {
      if (!shiftsByStaff.has(s.staff_id)) shiftsByStaff.set(s.staff_id, [])
      shiftsByStaff.get(s.staff_id)!.push(s)
    }

    let sentCount = 0
    const errors: string[] = []

    for (const staff of staffList ?? []) {
      const myShifts = shiftsByStaff.get(staff.id) ?? []
      let message: string

      if (myShifts.length === 0) {
        message = `📅 ${year}年${month}月のシフトが確定しました。\n\n${staff.name}さんは今月シフトが入っていません。\n\n来月のシフト希望があれば「シフト希望提出」ボタンから提出してください。`
      } else {
        const lines = myShifts
          .map((s: { date: string; start_time: string; end_time: string; role_on_day: string | null }) => {
            const day = parseInt(s.date.split('-')[2])
            const dow = DAYS_JP[new Date(s.date).getDay()]
            const role = s.role_on_day ? ` (${s.role_on_day})` : ''
            return `${month}/${day}(${dow}) ${s.start_time.slice(0, 5)}〜${s.end_time.slice(0, 5)}${role}`
          })
          .join('\n')

        message = `📅 ${year}年${month}月のシフトが確定しました！\n\n${staff.name}さんのシフト：\n${lines}\n\n全${myShifts.length}日\n\nご確認をよろしくお願いします🙌`
      }

      try {
        await sendLineMessage(staff.line_user_id, message)
        sentCount++
      } catch (e) {
        errors.push(`${staff.name}: ${(e as Error).message}`)
      }
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      totalStaff: staffList?.length ?? 0,
      errors,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
