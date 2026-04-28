export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/rocketnow-sync
 * ロケットナウのCSVを受け取り daily_sales の rocketnow_sales / rocketnow_orders を更新
 * delivery_sales / total_sales も再計算して反映
 *
 * body: { csv: string }
 *
 * CSVフォーマット（2パターン対応）:
 *   ① ヘッダーに「精算予定金額」列がある場合 → その列を使用
 *   ② ヘッダーなし or 列名不明の場合 → 一番右端の列を使用（Excelエクスポート対応）
 *
 *   日付列は「注文日」「日付」「date」などの列名 or 最初のYYYY-MM-DD形式の列を使用
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type DeliveryRow = { date: string; orders: number; amount: number }

/** 日付文字列を YYYY-MM-DD に変換 */
function normalizeDate(raw: string): string | null {
  // YYYY/M/D または YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY-M-D または YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

/** CSV/TSV行をカラム配列に分割 */
function splitLine(line: string): string[] {
  return line.split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, '').trim())
}

/** 数値文字列をパース（カンマ・円記号・空白対応） */
function parseAmount(s: string | undefined): number {
  if (!s) return 0
  const n = parseInt(s.replace(/[^0-9\-]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function parseRocketnowCsv(csv: string): DeliveryRow[] {
  // BOM除去
  const content = csv.replace(/^\uFEFF/, '')
  const lines = content.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const results: DeliveryRow[] = []

  // ── ヘッダー行を探す ──────────────────────────────
  // 「精算予定金額」「注文日」などのキーワードを含む行をヘッダーとして検出
  let headerIdx = -1
  let idxDate   = -1
  let idxAmount = -1  // 精算予定金額の列インデックス
  let idxOrders = -1

  // ヘッダーはExcelの場合4行の注記の後（最大10行以内）に出現する
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitLine(lines[i])
    // 「精算予定金額」が含まれていればヘッダー行確定
    const hasSettlement = cols.some(c => c.includes('精算予定金額'))
    if (hasSettlement) {
      headerIdx = i
      idxAmount = cols.findIndex(c => c.includes('精算予定金額'))
      // 取引日・注文日・日付・date いずれかの列を日付列とする
      idxDate   = cols.findIndex(c =>
        c.includes('取引日') || c.includes('注文日') || c.includes('日付') || c.toLowerCase().includes('date')
      )
      idxOrders = cols.findIndex(c => c.includes('注文数') || c.includes('件数') || c.toLowerCase().includes('count'))
      if (idxDate === -1) {
        // 日付列が見つからなければ最初に日付形式の値が入っている列を動的に探す
        idxDate = 0
      }
      break
    }
  }

  // ── データ行の処理 ──────────────────────────────
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0

  for (let i = dataStart; i < lines.length; i++) {
    const cols = splitLine(lines[i])
    if (cols.length < 2) continue

    // ヘッダーありパターン
    if (headerIdx >= 0) {
      const rawDate = cols[idxDate] ?? ''
      const date = normalizeDate(rawDate)
      if (!date) continue

      const amount = parseAmount(cols[idxAmount])
      const orders = idxOrders >= 0 ? parseAmount(cols[idxOrders]) : 1
      if (amount === 0) continue

      results.push({ date, orders, amount })
      continue
    }

    // ヘッダーなしパターン：日付 + 右端列（精算予定金額）
    const rawDate = cols[0]
    const date = normalizeDate(rawDate)
    if (!date) continue

    // 右端列が精算予定金額（Excelエクスポート仕様）
    const amount = parseAmount(cols[cols.length - 1])
    // 注文数は2列目があれば使用、なければ1件として扱う
    const orders = cols.length >= 3 ? parseAmount(cols[1]) : 1
    if (amount === 0) continue

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
