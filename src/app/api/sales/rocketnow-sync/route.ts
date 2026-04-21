export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/rocketnow-sync
 * ロケットナウのCSVを受け取り daily_sales の rocketnow_sales / rocketnow_orders を更新
 * delivery_sales / total_sales も再計算して反映
 *
 * body: { csv: string }
 *
 * CSVフォーマット（柔軟対応）:
 *   日付, 注文数, 売上金額  （カンマ or タブ区切り）
 *   YYYY-MM-DD, 3, 4500
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type DeliveryRow = { date: string; orders: number; amount: number }

function parseRocketnowCsv(csv: string): DeliveryRow[] {
  // BOM除去
  const content = csv.replace(/^\uFEFF/, '')
  const lines = content.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const results: DeliveryRow[] = []

  // ヘッダー行をスキップ（数字で始まらない行）
  let dataStart = 0
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i].trim().split(/[,\t]/)[0]?.replace(/"/g, '').trim()
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(first)) {
      dataStart = i
      break
    }
    dataStart = i + 1
  }

  for (const line of lines.slice(dataStart)) {
    const cols = line.split(/[,\t]/).map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 2) continue

    const rawDate = cols[0]
    let date = rawDate

    // YYYY/M/D → YYYY-MM-DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // YYYY-M-D → YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('-')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    const orders = cols.length >= 3 ? parseInt(cols[1].replace(/[^0-9]/g, '')) || 0 : 0
    const amount = cols.length >= 3
      ? parseInt(cols[2].replace(/[^0-9]/g, '')) || 0
      : parseInt(cols[1].replace(/[^0-9]/g, '')) || 0

    if (amount === 0 && orders === 0) continue

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

    const rows = parseRocketnowCsv(csv)
    if (rows.length === 0) {
      return NextResponse.json({
        error: 'CSVの形式が正しくありません',
        hint: '日付,注文数,売上金額 の形式で入力してください（ロケットナウの売上管理CSVを使用）',
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
        .select('store_sales, uber_sales, menu_sales')
        .eq('tenant_id', TENANT_ID)
        .eq('date', row.date)
        .single()

      const storeSales     = Number(existing?.store_sales) || 0
      const uberSales      = Number(existing?.uber_sales)  || 0
      const menuSales      = Number(existing?.menu_sales)  || 0
      const rocketnowSales = row.amount

      const deliverySales = uberSales + rocketnowSales + menuSales
      const totalSales    = storeSales + deliverySales

      // まず upsert（total_sales は除外）
      const upsertData: Record<string, unknown> = {
        tenant_id:           TENANT_ID,
        date:                row.date,
        rocketnow_sales:     rocketnowSales,
        rocketnow_orders:    row.orders,
        delivery_sales:      deliverySales,
        rocketnow_synced_at: now,
      }

      const { error: upsertError } = await db
        .from('daily_sales')
        .upsert(upsertData, { onConflict: 'tenant_id,date', ignoreDuplicates: false })

      if (upsertError) {
        errors.push(`${row.date}: ${upsertError.message}`)
        continue
      }

      // total_sales は GENERATED ALWAYS カラムのため DB 側で自動計算される
      updated.push(row.date)
    }

    return NextResponse.json({
      ok:      true,
      updated: updated.length,
      errors,
      dates:   updated,
      summary: rows.map(r => ({
        date:    r.date,
        orders:  r.orders,
        sales:   r.amount,
        syncedAt: now,
      })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
