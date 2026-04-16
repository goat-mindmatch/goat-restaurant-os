export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/upload
 * AnyDeli Excel / Uber Eats CSV を受け取って daily_sales に保存
 * FormData: file (File), source ('anydeli' | 'ubereats')
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type DailyRow = {
  date: string // YYYY-MM-DD
  store_sales: number
  delivery_sales: number
  store_orders: number
  delivery_orders: number
}

// Excel/CSV パーサ
function parseWorkbook(wb: XLSX.WorkBook): DailyRow[] {
  const sheet = wb.Sheets[wb.SheetNames[0]]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '', raw: false })

  const results: DailyRow[] = []

  for (const row of rows) {
    // 日付カラムを柔軟に探す
    const dateRaw = row['日付'] ?? row['月日'] ?? row['date'] ?? row['Date'] ?? row['日']
    if (!dateRaw) continue

    const dateStr = normalizeDate(String(dateRaw))
    if (!dateStr) continue

    // 売上・注文数を柔軟に取得
    const storeSales = toNum(
      row['店内売上'] ?? row['店内'] ?? row['店舗売上'] ?? row['in_store'] ?? row['店内合計'] ?? 0
    )
    const deliverySales = toNum(
      row['デリバリー売上'] ?? row['デリバリー'] ?? row['配達売上'] ?? row['delivery'] ?? row['UberEats'] ?? 0
    )
    const storeOrders = toNum(
      row['店内注文数'] ?? row['店内件数'] ?? row['注文数'] ?? row['store_orders'] ?? 0
    )
    const deliveryOrders = toNum(
      row['デリバリー注文数'] ?? row['デリバリー件数'] ?? row['配達件数'] ?? row['delivery_orders'] ?? 0
    )

    // 全部0ならスキップ
    if (storeSales === 0 && deliverySales === 0 && storeOrders === 0 && deliveryOrders === 0) continue

    results.push({
      date: dateStr,
      store_sales: storeSales,
      delivery_sales: deliverySales,
      store_orders: storeOrders,
      delivery_orders: deliveryOrders,
    })
  }

  return results
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/[,¥円]/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n)
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/').map(Number)
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // MM/DD or M/D (年は現在年)
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
    const [m, d] = s.split('/').map(Number)
    const y = new Date().getFullYear()
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // Excel シリアル日付
  if (/^\d+$/.test(s) && Number(s) > 40000 && Number(s) < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(excelEpoch.getTime() + Number(s) * 86400000)
    const yy = d.getUTCFullYear()
    const mm = d.getUTCMonth() + 1
    const dd = d.getUTCDate()
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const rows = parseWorkbook(wb)

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'データを認識できませんでした。Excelの列名を確認してください（日付/店内売上/デリバリー売上 など）',
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // Upsert 一括
    const upsertRows = rows.map(r => ({
      tenant_id: TENANT_ID,
      date: r.date,
      store_sales: r.store_sales,
      delivery_sales: r.delivery_sales,
      store_orders: r.store_orders,
      delivery_orders: r.delivery_orders,
      data_source: 'anydeli_excel',
      updated_at: new Date().toISOString(),
    }))

    const { error } = await db.from('daily_sales').upsert(upsertRows, {
      onConflict: 'tenant_id,date',
    })
    if (error) throw error

    return NextResponse.json({ ok: true, count: rows.length, sample: rows.slice(0, 3) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
