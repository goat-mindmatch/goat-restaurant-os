export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/uber-sync
 * Uber Eats CSVを解析して daily_sales に自動反映
 *
 * 対応フォーマット（2種類を自動判別）:
 *
 * [Format A] お支払いの詳細CSV（旧形式）
 *   ヘッダー行: 「注文 ID」で始まる
 *   データ行: 注文 ID が「#」で始まる行のみ集計
 *
 * [Format B] 注文データエクスポートCSV（新形式 / 54列）
 *   1行目: 英語説明文
 *   2行目: 日本語列名（「注文日付」「合計支払い額（消費税を含む）」「注文状況」含む）
 *   データ行: 「注文状況」が「完了」の行のみ集計
 *
 * 集計キー:
 *   注文日付                      → YYYY/M/D → YYYY-MM-DD
 *   合計支払い額（消費税を含む）  → uber_sales（Uber手数料差引後の実入金額）= AU列
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type DaySummary = {
  date: string        // YYYY-MM-DD
  orders: number      // 注文件数
  sales: number       // 売上合計（消費税込）
  netPayout: number   // 実手取り合計（Uber手数料差引後）
}

/**
 * Uber Eats CSVをパース（Format A / Format B を自動判別）
 *
 * Format A: ヘッダー行の先頭列が「注文 ID」→ #で始まる行のみ集計
 * Format B: ヘッダー行に「注文日付」が含まれる → 「注文状況」=「完了」行のみ集計
 */
function parseUberCsv(csvRaw: string): DaySummary[] {
  // BOMを除去して行分割
  const content = csvRaw.replace(/^\uFEFF/, '')
  const lines = content.split('\n')

  // ── フォーマット判別・ヘッダー行検出 ──────────────────────────
  let headerIdx = -1
  let format: 'A' | 'B' | null = null

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cols = parseCsvLine(lines[i])
    // Format A: 先頭列が「注文 ID」
    if (cols[0]?.trim() === '注文 ID') {
      headerIdx = i
      format = 'A'
      break
    }
    // Format B: 列の中に「注文日付」が含まれる（英語説明の次行 = 日本語列名行）
    if (cols.some(c => c.trim() === '注文日付')) {
      headerIdx = i
      format = 'B'
      break
    }
  }

  if (headerIdx === -1 || !format) return []

  // ── カラムインデックスを取得 ──────────────────────────────────
  const headers = parseCsvLine(lines[headerIdx])

  const idxDate      = headers.findIndex(h => h.trim() === '注文日付')
  const idxSales     = headers.findIndex(h => h.trim() === '売上（消費税を含む）')
  const idxNetPayout = headers.findIndex(h => h.trim() === '合計支払い額（消費税を含む）')

  // Format A: 注文 ID 列（#フィルタ用）
  const idxOrderId = headers.findIndex(h => h.trim() === '注文 ID')
  // Format B: 注文状況列（「完了」フィルタ用）
  const idxStatus  = headers.findIndex(h => h.trim() === '注文状況')

  if (idxDate === -1) return []

  // ── データ行を集計 ────────────────────────────────────────────
  const byDate: Record<string, DaySummary> = {}

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCsvLine(line)
    if (cols.length < 5) continue

    if (format === 'A') {
      // Format A: 注文 ID が「#」で始まる行のみ（ヘッダー・合計行を除外）
      const orderId = cols[idxOrderId]?.trim() ?? ''
      if (!orderId.startsWith('#')) continue
    } else {
      // Format B: 注文状況が「完了」の行のみ（キャンセル・払い戻しを除外）
      const status = idxStatus >= 0 ? cols[idxStatus]?.trim() : ''
      if (status !== '完了') continue
    }

    // 日付変換: YYYY/M/D → YYYY-MM-DD
    const rawDate = cols[idxDate]?.trim() ?? ''
    const date = convertDate(rawDate)
    if (!date) continue

    const sales     = idxSales >= 0     ? parseNum(cols[idxSales])     : 0
    const netPayout = idxNetPayout >= 0 ? parseNum(cols[idxNetPayout]) : 0

    if (!byDate[date]) {
      byDate[date] = { date, orders: 0, sales: 0, netPayout: 0 }
    }
    byDate[date].orders++
    byDate[date].sales     += sales     // 参考値（gross）
    byDate[date].netPayout += netPayout // 実入金額（合計支払い額）
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
}

/** 日付文字列を YYYY-MM-DD に変換 */
function convertDate(raw: string): string | null {
  // YYYY/M/D または YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY-MM-DD はそのまま
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

/** 数値文字列をパース（カンマ・空白・マイナス対応） */
function parseNum(s: string | undefined): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/[,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

/** CSV行をフィールド配列に分割（クォート対応） */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuote = !inQuote
    } else if (c === ',' && !inQuote) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

// ────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { csv } = body

    if (!csv) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    const rows = parseUberCsv(csv)
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: 'CSVの形式が正しくありません',
          hint: 'Uber Eats Manager の「注文データエクスポート」または「お支払いの詳細」CSVを使用してください',
        },
        { status: 400 }
      )
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
        .select('store_sales, rocketnow_sales, menu_sales')
        .eq('tenant_id', TENANT_ID)
        .eq('date', row.date)
        .single()

      const storeSales     = Number(existing?.store_sales)     || 0
      const rocketnowSales = Number(existing?.rocketnow_sales) || 0
      const menuSales      = Number(existing?.menu_sales)      || 0
      // 合計支払い額（Uber手数料差引後の実入金額）を使用
      // netPayoutが0の場合（CSVに列がない）は売上で代用
      const uberSales      = row.netPayout > 0 ? row.netPayout : row.sales

      // delivery_sales = Uber + Rocketnow + menu
      const deliverySales = uberSales + rocketnowSales + menuSales
      // total_sales = 店内 + デリバリー全媒体
      const totalSales    = storeSales + deliverySales

      const { error: upsertError } = await db
        .from('daily_sales')
        .upsert(
          {
            tenant_id:      TENANT_ID,
            date:           row.date,
            uber_sales:     uberSales,
            uber_orders:    row.orders,
            delivery_sales: deliverySales,
            uber_synced_at: now,
          },
          { onConflict: 'tenant_id,date', ignoreDuplicates: false }
        )

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
        date:       r.date,
        orders:     r.orders,
        sales:      r.sales,
        netPayout:  r.netPayout,
        syncedAt:   now,
      })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GETはcron用（将来の拡張用stub）
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    message: '自動取込はscrape-delivery.jsで実行されます',
  })
}
