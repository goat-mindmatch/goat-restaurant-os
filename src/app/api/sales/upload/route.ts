export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/upload
 * 媒体別Excel/CSVを受け取って daily_sales に保存
 * FormData:
 *   file   : File
 *   platform: 'anydeli' | 'uber' | 'rocketnow' | 'menu'
 *
 * platform ごとに更新するカラムが変わる
 *   anydeli   → store_sales / store_orders
 *   uber      → uber_sales / uber_orders
 *   rocketnow → rocketnow_sales / rocketnow_orders
 *   menu      → menu_sales / menu_orders
 * delivery_sales は常に uber+rocketnow+menu の合計に更新
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type Platform = 'anydeli' | 'uber' | 'rocketnow' | 'menu'

type ParsedRow = {
  date: string
  sales: number
  orders: number
}

// ==================== ユーティリティ ====================

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/[,¥円\s]/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n)
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/').map(Number)
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
    const [m, d] = s.split('/').map(Number)
    const y = new Date().getFullYear()
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  if (/^\d+$/.test(s) && Number(s) > 40000 && Number(s) < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(excelEpoch.getTime() + Number(s) * 86400000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return null
}

// ==================== 媒体別パーサ ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAnydeli(rows: any[]): ParsedRow[] {
  const results: ParsedRow[] = []
  for (const row of rows) {
    const dateRaw = row['日付'] ?? row['月日'] ?? row['date'] ?? row['Date'] ?? row['日']
    if (!dateRaw) continue
    const date = normalizeDate(String(dateRaw))
    if (!date) continue
    const sales = toNum(row['店内売上'] ?? row['店内'] ?? row['店舗売上'] ?? row['合計売上'] ?? row['売上'] ?? row['in_store'] ?? 0)
    const orders = toNum(row['店内注文数'] ?? row['店内件数'] ?? row['注文数'] ?? row['store_orders'] ?? 0)
    if (sales === 0 && orders === 0) continue
    results.push({ date, sales, orders })
  }
  return results
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseUber(rows: any[]): ParsedRow[] {
  const results: ParsedRow[] = []
  for (const row of rows) {
    // Uber Eats の日次レポート形式（複数パターン対応）
    const dateRaw =
      row['注文日'] ?? row['日付'] ?? row['Date'] ?? row['date'] ??
      row['配達日'] ?? row['期間'] ?? row['Week'] ?? null
    if (!dateRaw) continue
    const date = normalizeDate(String(dateRaw))
    if (!date) continue
    // 売上：手数料差引前の総売上
    const sales = toNum(
      row['総売上'] ?? row['合計売上'] ?? row['売上'] ??
      row['Gross sales'] ?? row['Total sales'] ?? row['Net earnings'] ??
      row['売上合計'] ?? row['お支払い金額'] ?? 0
    )
    const orders = toNum(
      row['注文数'] ?? row['件数'] ?? row['Orders'] ?? row['Total orders'] ?? 0
    )
    if (sales === 0 && orders === 0) continue
    results.push({ date, sales, orders })
  }
  return results
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRocketnow(rows: any[]): ParsedRow[] {
  const results: ParsedRow[] = []
  for (const row of rows) {
    const dateRaw =
      row['日付'] ?? row['注文日'] ?? row['date'] ?? row['Date'] ??
      row['配達日'] ?? null
    if (!dateRaw) continue
    const date = normalizeDate(String(dateRaw))
    if (!date) continue
    const sales = toNum(
      row['売上'] ?? row['合計売上'] ?? row['総売上'] ?? row['売上金額'] ??
      row['お支払い金額'] ?? row['精算金額'] ?? 0
    )
    const orders = toNum(
      row['注文数'] ?? row['件数'] ?? row['オーダー数'] ?? 0
    )
    if (sales === 0 && orders === 0) continue
    results.push({ date, sales, orders })
  }
  return results
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMenu(rows: any[]): ParsedRow[] {
  const results: ParsedRow[] = []
  for (const row of rows) {
    const dateRaw = row['日付'] ?? row['注文日'] ?? row['date'] ?? row['Date'] ?? null
    if (!dateRaw) continue
    const date = normalizeDate(String(dateRaw))
    if (!date) continue
    const sales = toNum(row['売上'] ?? row['合計売上'] ?? row['総売上'] ?? 0)
    const orders = toNum(row['注文数'] ?? row['件数'] ?? 0)
    if (sales === 0 && orders === 0) continue
    results.push({ date, sales, orders })
  }
  return results
}

// ==================== メインハンドラ ====================

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const platform = (form.get('platform') as Platform) ?? 'anydeli'

    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (!['anydeli', 'uber', 'rocketnow', 'menu'].includes(platform)) {
      return NextResponse.json({ error: '不明な媒体です' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '', raw: false })

    const parsers: Record<Platform, (r: typeof rawRows) => ParsedRow[]> = {
      anydeli:   parseAnydeli,
      uber:      parseUber,
      rocketnow: parseRocketnow,
      menu:      parseMenu,
    }

    const rows = parsers[platform](rawRows)

    if (rows.length === 0) {
      return NextResponse.json({
        error: `データを認識できませんでした（${platform}）。列名を確認してください。`,
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 既存データを取得して delivery_sales を正しく更新する
    const dates = rows.map(r => r.date)
    const { data: existing } = await db.from('daily_sales')
      .select('date, uber_sales, rocketnow_sales, menu_sales')
      .eq('tenant_id', TENANT_ID)
      .in('date', dates)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingMap: Record<string, any> = {}
    for (const row of existing ?? []) existingMap[row.date] = row

    const upsertRows = rows.map(r => {
      const ex = existingMap[r.date] ?? {}

      const uberS      = platform === 'uber'      ? r.sales : (ex.uber_sales      ?? 0)
      const rocketnowS = platform === 'rocketnow' ? r.sales : (ex.rocketnow_sales ?? 0)
      const menuS      = platform === 'menu'       ? r.sales : (ex.menu_sales      ?? 0)
      const deliveryS  = uberS + rocketnowS + menuS

      const base: Record<string, unknown> = {
        tenant_id:        TENANT_ID,
        date:             r.date,
        delivery_sales:   deliveryS,
        data_source:      `${platform}_excel`,
        updated_at:       new Date().toISOString(),
      }

      if (platform === 'anydeli') {
        base.store_sales   = r.sales
        base.store_orders  = r.orders
      } else if (platform === 'uber') {
        base.uber_sales    = r.sales
        base.uber_orders   = r.orders
        base.delivery_orders = (ex.delivery_orders ?? 0) - (ex.uber_orders ?? 0) + r.orders
      } else if (platform === 'rocketnow') {
        base.rocketnow_sales   = r.sales
        base.rocketnow_orders  = r.orders
        base.delivery_orders   = (ex.delivery_orders ?? 0) - (ex.rocketnow_orders ?? 0) + r.orders
      } else if (platform === 'menu') {
        base.menu_sales   = r.sales
        base.menu_orders  = r.orders
        base.delivery_orders = (ex.delivery_orders ?? 0) - (ex.menu_orders ?? 0) + r.orders
      }

      return base
    })

    const { error } = await db.from('daily_sales').upsert(upsertRows, {
      onConflict: 'tenant_id,date',
    })
    if (error) throw error

    return NextResponse.json({
      ok: true,
      platform,
      count: rows.length,
      sample: rows.slice(0, 3),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
