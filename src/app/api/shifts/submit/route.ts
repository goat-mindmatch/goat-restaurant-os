export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { lineUserId, year, month, days } = await req.json()

    if (!lineUserId || !year || !month || !days?.length) {
      return NextResponse.json({ error: 'invalid params' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // スタッフ確認
    const { data: staff } = await db
      .from('staff').select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('line_user_id', lineUserId)
      .single()

    if (!staff) {
      return NextResponse.json({ error: 'staff not found' }, { status: 404 })
    }

    // 選択された日付リスト
    const availableDates = days.map((d: { date: string }) => d.date)

    // シフト希望を保存（upsert）
    await db.from('shift_requests').upsert({
      tenant_id: TENANT_ID,
      staff_id: staff.id,
      target_year: year,
      target_month: month,
      available_dates: availableDates,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'staff_id,target_year,target_month' })

    // 時間情報をnotesに保存（将来的には専用テーブルへ）
    const timeNotes = days
      .map((d: { date: string; startTime: string; endTime: string }) =>
        `${d.date}: ${d.startTime}〜${d.endTime}`
      ).join(', ')

    await db.from('shift_requests')
      .update({ note: timeNotes })
      .eq('staff_id', staff.id)
      .eq('target_year', year)
      .eq('target_month', month)

    return NextResponse.json({ ok: true, name: staff.name, count: availableDates.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
