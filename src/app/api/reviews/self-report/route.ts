export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/self-report
 * PINログイン中スタッフが「口コミを案内した」ことを1件ずつ記録
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

const TENANT_ID = process.env.TENANT_ID!
const DAILY_SELF_REPORT_LIMIT = 20

function getJstDayRange(date: Date) {
  const jstBase = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const startJst = new Date(Date.UTC(
    jstBase.getUTCFullYear(),
    jstBase.getUTCMonth(),
    jstBase.getUTCDate(),
    0,
    0,
    0,
    0,
  ))
  const start = new Date(startJst.getTime() - 9 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as { count?: number }
    const requestedCount = Math.floor(Number(payload.count ?? 1))
    const count = Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(requestedCount, DAILY_SELF_REPORT_LIMIT)
      : 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const now = new Date().toISOString()
    const { start, end } = getJstDayRange(new Date())

    const { count: todayCountRaw, error: countError } = await db
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID)
      .eq('staff_id', session.staffId)
      .eq('auto_attributed', false)
      .eq('note', 'self-reported')
      .gte('clicked_at', start)
      .lt('clicked_at', end)

    if (countError) throw countError

    const todayCount = todayCountRaw ?? 0
    const available = Math.max(0, DAILY_SELF_REPORT_LIMIT - todayCount)

    if (available <= 0) {
      return NextResponse.json({
        error: '本日の自己申告上限に到達しました。',
        limit: DAILY_SELF_REPORT_LIMIT,
        today_count: todayCount,
      }, { status: 429 })
    }

    const insertCount = Math.min(count, available)
    const rows = Array.from({ length: insertCount }, () => ({
      tenant_id: TENANT_ID,
      staff_id: session.staffId,
      completed: true,
      verified_at: now,
      exp_awarded: 150,
      auto_attributed: false,
      note: 'self-reported',
      clicked_at: now,
      completed_at: now,
    }))

    const { error: insertError, data } = await db
      .from('reviews')
      .insert(rows)
      .select('id')

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      ok: true,
      inserted: data?.length ?? insertCount,
      requested: count,
      truncated: count > available,
      today_count: todayCount + (data?.length ?? insertCount),
      limit: DAILY_SELF_REPORT_LIMIT,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
