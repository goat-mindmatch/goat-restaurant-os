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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const updated: string[] = []
    const errors: string[] = []
    const now = new Date().toISOString()

    for (const row of rows) {
      // 既存レコードを取得して他媒体の売上を保持しつつ合計を再計算
      const { data: existing } = await db
        .from('daily_sales')
        .select('store_sales, uber_sales, rocketnow_sales')
        .eq('tenant_id', TENANT_ID)
        .eq('date', row.date)
        .single()

      const storeSales     = Number(existing?.store_sales)     || 0
      const uberSales      = Number(existing?.uber_sales)      || 0
      const rocketnowSales = Number(existing?.rocketnow_sales) || 0
      const menuSales      = row.amount

      const deliverySales = uberSales + rocketnowSales + menuSales
      const totalSales    = storeSales + deliverySales

      const { error: upsertError } = await db
        .from('daily_sales')
        .upsert(
          {
            tenant_id:      TENANT_ID,
            date:           row.date,
            menu_sales:     menuSales,
            menu_orders:    row.orders,
            delivery_sales: deliverySales,
            menu_synced_at: now,
          },
          { onConflict: 'tenant_id,date', ignoreDuplicates: false }
        )

      if (upsertError) { errors.push(`${row.date}: ${upsertError.message}`); continue }

      // total_sales は GENERATED ALWAYS カラムのため DB 側で自動計算される
      updated.push(row.date)
    }

    return NextResponse.json({
      ok:      true,
      updated: updated.length,
      errors,
      dates:   updated,
      summary: rows.map(r => ({
        date:     r.date,
        orders:   r.orders,
        sales:    r.amount,
        syncedAt: now,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
