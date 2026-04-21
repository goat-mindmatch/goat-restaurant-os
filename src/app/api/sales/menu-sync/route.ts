export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/menu-sync
 * menu（menu.jp）のCSVを受け取り daily_sales の menu_sales / menu_orders を更新
 *
 * body: { csv: string }
 *
 * menu CSVの一般的な形式:
 *   日付, 注文数, 売上金額
 *   2026-04-01, 5, 7500
 *
 * 英語ヘッダー (Date, Orders, Amount) も自動判別
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type DeliveryRow = { date: string; orders: number; amount: number }

function parseDeliveryCsv(csv: string): DeliveryRow[] {
  const lines = csv.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const results: DeliveryRow[] = []
  for (const line of lines.slice(1)) {
    // タブ区切りにも対応
    const cols = line.split(/[,\t]/).map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 2) continue

    const rawDate = cols[0]
    let date = rawDate
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const [m, d, y] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    // 列数が2のとき: 日付, 売上（注文数なし）
    const orders = cols.length >= 3 ? parseInt(cols[1].replace(/[^0-9]/g, '')) || 0 : 0
    const amount = cols.length >= 3
      ? parseInt(cols[2].replace(/[^0-9]/g, '')) || 0
      : parseInt(cols[1].replace(/[^0-9]/g, '')) || 0

    results.push({ date, orders, amount })
  }
  return results
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { csv } = body as { csv: string }
    if (!csv?.trim()) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    const rows = parseDeliveryCsv(csv)
    if (rows.length === 0) {
      return NextResponse.json({
        error: 'CSVの形式が正しくありません',
        hint: '日付,注文数,売上金額 の形式で入力してください',
      }, { status: 400 })
    }

    const db = createServiceClient() as any
    const updated: string[] = []
    const errors: string[] = []

    for (const row of rows) {
      const { error } = await db
        .from('daily_sales')
        .upsert({
          tenant_id: TENANT_ID,
          date: row.date,
          menu_sales: row.amount,
          menu_orders: row.orders,
        }, { onConflict: 'tenant_id,date', ignoreDuplicates: false })

      if (error) errors.push(`${row.date}: ${error.message}`)
      else updated.push(row.date)
    }

    return NextResponse.json({ ok: true, updated: updated.length, errors, dates: updated })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
