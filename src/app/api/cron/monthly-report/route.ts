export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/monthly-report
 * 毎月1日 朝9時に前月のレポートをLINEで経営者に送信
 * Vercel Cron / launchd から呼び出す
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: NextRequest) {
  // 簡易認証（CRON_SECRETが設定されている場合）
  const auth = req.headers.get('x-cron-secret')
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 先月の期間を計算
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const firstDay  = lastMonth.toISOString().split('T')[0]
  const lastDay   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
  const monthLabel = `${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月`

  // 売上データ取得
  const { data: salesRows } = await db.from('daily_sales')
    .select('date, total_sales, store_sales, delivery_sales, food_cost, labor_cost')
    .eq('tenant_id', TENANT_ID)
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date')

  if (!salesRows?.length) {
    return NextResponse.json({ ok: false, message: '売上データなし' })
  }

  // 集計
  const totalSales    = salesRows.reduce((s: number, r: { total_sales: number | null })    => s + (r.total_sales    ?? 0), 0)
  const totalStore    = salesRows.reduce((s: number, r: { store_sales: number | null })    => s + (r.store_sales    ?? 0), 0)
  const totalDelivery = salesRows.reduce((s: number, r: { delivery_sales: number | null }) => s + (r.delivery_sales ?? 0), 0)
  const totalFoodCost = salesRows.reduce((s: number, r: { food_cost: number | null })      => s + (r.food_cost      ?? 0), 0)
  const totalLabor    = salesRows.reduce((s: number, r: { labor_cost: number | null })     => s + (r.labor_cost     ?? 0), 0)
  const salesDays     = salesRows.filter((r: { total_sales: number | null }) => (r.total_sales ?? 0) > 0).length

  // 月間目標
  const { data: tenant } = await db.from('tenants').select('monthly_target, name').eq('id', TENANT_ID).single()
  const target = tenant?.monthly_target ?? 0
  const achievePct = target > 0 ? Math.round(totalSales / target * 100) : null

  // 最高売上日
  const best = salesRows.reduce(
    (max: { date: string; total_sales: number | null }, r: { date: string; total_sales: number | null }) =>
      (r.total_sales ?? 0) > (max.total_sales ?? 0) ? r : max,
    salesRows[0]
  )
  const bestDate  = best.date.slice(5).replace('-', '/')
  const bestSales = best.total_sales ?? 0

  // FL比率
  const flCost = totalFoodCost + totalLabor
  const flRatio = totalSales > 0 ? Math.round(flCost / totalSales * 100) : null

  const fmt = (n: number) => `¥${n.toLocaleString()}`

  const report =
    `📊 ${monthLabel} 月次レポート\n\n` +
    `━━━━━━━━━━━━\n` +
    `💴 月間売上合計\n${fmt(totalSales)}` +
    (achievePct !== null ? `（目標比 ${achievePct}%）` : '') + '\n\n' +
    `🏪 店内：${fmt(totalStore)}\n` +
    `🛵 デリバリー：${fmt(totalDelivery)}\n\n` +
    `📅 営業日数：${salesDays}日\n` +
    `📈 日平均売上：${fmt(salesDays > 0 ? Math.round(totalSales / salesDays) : 0)}\n` +
    `🏆 最高売上日：${bestDate}（${fmt(bestSales)}）\n` +
    `━━━━━━━━━━━━\n` +
    (flRatio !== null
      ? `🥩 食材費：${fmt(totalFoodCost)}（${Math.round(totalFoodCost / totalSales * 100)}%）\n` +
        `👥 人件費：${fmt(totalLabor)}（${Math.round(totalLabor / totalSales * 100)}%）\n` +
        `📐 FL比率：${flRatio}%\n` +
        `━━━━━━━━━━━━\n`
      : '') +
    `\n詳細はダッシュボードで確認できます👇\nhttps://goat-restaurant-os.vercel.app/dashboard/pl`

  // 経営者全員に送信
  const { data: managers } = await db.from('staff')
    .select('line_user_id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('role', 'manager')
    .eq('is_active', true)
    .not('line_user_id', 'is', null)

  const results: { name: string; ok: boolean }[] = []
  for (const m of managers ?? []) {
    try {
      await sendLineMessage(m.line_user_id, report)
      results.push({ name: m.name, ok: true })
    } catch {
      results.push({ name: m.name, ok: false })
    }
  }

  return NextResponse.json({ ok: true, month: monthLabel, sent_to: results })
}

// Vercel Cron からの GET にも対応
export async function GET(req: NextRequest) {
  return POST(req)
}
