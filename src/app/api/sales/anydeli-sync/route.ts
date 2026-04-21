export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/anydeli-sync
 * AnyDeli（エニデリ）の売上を受け取り daily_sales の anydeli_* カラムを更新
 *
 * 受付形式A（JSON）: { date, orders, sales, cash_sales?, online_sales? }
 * 受付形式B（CSV）:  { csv: "日付,注文数,売上金額\nYYYY-MM-DD,N,AMOUNT" }  ← 旧形式
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type Row = {
  date: string
  orders: number
  amount: number
  cash_sales?: number
  online_sales?: number
}

function parseCsv(csv: string): Row[] {
  const content = csv.replace(/^\uFEFF/, '')
  const lines = content.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const results: Row[] = []
  let dataStart = 0
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i].trim().split(/[,\t]/)[0]?.replace(/"/g, '').trim()
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(first)) { dataStart = i; break }
    dataStart = i + 1
  }

  for (const line of lines.slice(dataStart)) {
    const cols = line.split(/[,\t]/).map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 2) continue

    const rawDate = cols[0]
    let date = rawDate
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('-')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

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

    let rows: Row[] = []

    // 形式A: JSON { date, orders, sales, cash_sales?, online_sales? }
    if (body.date && typeof body.date === 'string') {
      const d = body.date.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return NextResponse.json({ error: 'date形式はYYYY-MM-DDで指定してください' }, { status: 400 })
      }
      rows = [{
        date:         d,
        orders:       Math.round(Number(body.orders) || 0),
        amount:       Math.round(Number(body.sales)  || 0),
        cash_sales:   body.cash_sales   !== undefined ? Math.round(Number(body.cash_sales))   : undefined,
        online_sales: body.online_sales !== undefined ? Math.round(Number(body.online_sales)) : undefined,
      }]
    }
    // 形式B: CSV { csv: "..." }
    else if (body.csv?.trim()) {
      const parsed = parseCsv(body.csv)
      if (parsed.length === 0) {
        return NextResponse.json({
          error: 'CSVの形式が正しくありません',
          hint: '日付,注文数,売上金額 の形式で入力してください',
        }, { status: 400 })
      }
      rows = parsed
    } else {
      return NextResponse.json({
        error: 'リクエスト形式が不正です',
        hint: '{ date, orders, sales } または { csv } を指定してください',
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const updated: string[] = []
    const errors: string[] = []
    const now = new Date().toISOString()

    for (const row of rows) {
      const upsertPayload: Record<string, unknown> = {
        tenant_id:         TENANT_ID,
        date:              row.date,
        anydeli_sales:     row.amount,
        anydeli_orders:    row.orders,
        anydeli_synced_at: now,
        // store_sales にも反映させることで total_sales（= store_sales + delivery_sales）に乗る
        store_sales:       row.amount,
        store_orders:      row.orders,
        data_source:       'api',
      }

      // 現金/オンライン内訳が提供された場合のみ更新
      if (row.cash_sales !== undefined)   upsertPayload.anydeli_cash_sales   = row.cash_sales
      if (row.online_sales !== undefined) upsertPayload.anydeli_online_sales = row.online_sales

      const { error: upsertError } = await db
        .from('daily_sales')
        .upsert(upsertPayload, { onConflict: 'tenant_id,date', ignoreDuplicates: false })

      if (upsertError) {
        errors.push(`${row.date}: ${upsertError.message}`)
        continue
      }

      updated.push(row.date)
    }

    return NextResponse.json({
      ok:      true,
      updated: updated.length,
      errors,
      dates:   updated,
      summary: rows.map(r => ({
        date:        r.date,
        orders:      r.orders,
        sales:       r.amount,
        cash_sales:  r.cash_sales,
        online_sales: r.online_sales,
        syncedAt:    now,
      })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
