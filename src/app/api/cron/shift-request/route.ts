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
import { sendShiftRequestBroadcast } from '@/lib/shift-request'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  // Vercel Cron の認証
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const result = await sendShiftRequestBroadcast(db, TENANT_ID)
    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
