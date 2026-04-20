export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/auto-fixed-costs
 * 毎月1日 朝9:05 JST (0:05 UTC) に前月の固定費を expenses テーブルに自動計上
 * Vercel Cron から呼び出す
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

async function run(year?: number, month?: number) {
  const db = createServiceClient() as any

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const targetYear  = year  ?? now.getFullYear()
  const targetMonth = month ?? (now.getMonth() + 1)
  const firstDay = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
  const monthLabel = `${targetYear}年${targetMonth}月`

  // アクティブな固定費を取得
  const { data: fixedCosts, error } = await db
    .from('fixed_costs')
    .select('id, category, amount, label')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)

  if (error) throw error
  if (!fixedCosts?.length) {
    return NextResponse.json({ ok: true, message: '固定費なし', inserted: 0 })
  }

  // 既に当月分が登録済みか確認（二重計上防止）
  const { data: existing } = await db
    .from('expenses')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .eq('date', firstDay)
    .eq('note', `auto:fixed_cost:${firstDay}`)
    .limit(1)

  if (existing?.length) {
    return NextResponse.json({ ok: true, message: '既に計上済み', inserted: 0 })
  }

  // expenses に挿入
  const rows = fixedCosts.map((fc: any) => ({
    tenant_id: TENANT_ID,
    date: firstDay,
    category: fc.category ?? 'other',
    vendor: fc.label ?? fc.category,
    amount: fc.amount,
    note: `auto:fixed_cost:${firstDay}`,
    ai_extracted: false,
  }))

  const { error: insertError } = await db.from('expenses').insert(rows)
  if (insertError) throw insertError

  return NextResponse.json({
    ok: true,
    month: monthLabel,
    inserted: rows.length,
    total: fixedCosts.reduce((s: number, f: any) => s + f.amount, 0),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { year?: number; month?: number }
  return run(body.year, body.month)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = searchParams.get('year')  ? Number(searchParams.get('year'))  : undefined
  const month = searchParams.get('month') ? Number(searchParams.get('month')) : undefined
  return run(year, month)
}
