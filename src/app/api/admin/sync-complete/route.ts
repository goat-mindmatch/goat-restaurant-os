export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-complete
 * スクレイパーが同期完了後に呼び出すエンドポイント
 * 1. tenants.sync_completed_at を更新
 * 2. 今日・昨日のAI日報を自動生成（ボタンを押さなくても更新される）
 */

import { NextResponse, NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID    = process.env.TENANT_ID!
const INTERNAL_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://goat-restaurant-os.vercel.app'

function jstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const now = new Date().toISOString()

    // 1. 同期完了を記録
    const { error } = await db
      .from('tenants')
      .update({ sync_completed_at: now })
      .eq('id', TENANT_ID)

    if (error) throw error

    // 2. 今日・昨日のAI日報を非同期で自動生成（失敗してもsync-completeは成功扱い）
    const today     = jstDate(0)
    const yesterday = jstDate(-1)

    Promise.all([today, yesterday].map(date =>
      fetch(`${INTERNAL_URL}/api/reports/daily`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date }),
      }).catch(e => console.warn(`AI日報自動生成失敗 (${date}):`, e))
    ))

    return NextResponse.json({ ok: true, completed_at: now, auto_report: [today, yesterday] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
