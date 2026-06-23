export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/shifts/request-broadcast
 * 「シフト希望提出依頼」を全スタッフのLINEへ手動で一斉送信する（管理画面のボタン用）。
 * 毎月20日のcron(/api/cron/shift-request)が不発でも、ここから手動で送れる。
 * 内容は cron と同じ（翌月のシフト希望提出依頼・提出期限は今月25日）。
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendShiftRequestBroadcast } from '@/lib/shift-request'

const TENANT_ID = process.env.TENANT_ID!

export async function POST() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const result = await sendShiftRequestBroadcast(db, TENANT_ID)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
