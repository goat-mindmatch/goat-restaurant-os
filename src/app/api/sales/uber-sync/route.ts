export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/uber-sync
 * Uber Eats「お支払いの詳細」CSVを解析して daily_sales に自動反映
 *
 * CSVフォーマット（実際のUber Eats Manager出力）:
 *   1行目: カラム説明文（スキップ）
 *   2行目: カラム説明文の続き（スキップ）
 *   3行目: ヘッダー行（「注文 ID」で始まる）
 *   4行目以降: データ行
 *
 * 主要カラム:
 *   注文日付         → 集計キー (YYYY/M/D → YYYY-MM-DD)
 *   売上（消費税を含む）→ uber_sales に集計
 *   合計支払い額（消費税を含む）→ 実質手取り（将来的にuber_net列追加時に利用）
 *   注文 ID          → 件数カウント（#で始まる行のみ）
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
 * Uber Eats「お支払いの詳細」CSVをパース
 * ヘッダー行を自動検出（「注文 ID」で始まる行）
 */
function parseUberCsv(csvRaw: string): DaySummary[] {
  // BOMを除去して行分割
  const content = csvRaw.replace(/^\uFEFF/, '')
  const lines = content.split('\n')

  // 「注文 ID」で始まるヘッダー行を探す
  const headerIdx = lines.findIndex(l => l.trimStart().startsWith('注文 ID'))
  if (headerIdx === -1) {
    return []
  }

  // ヘッダー行をパース
  const headers = parseCsvLine(lines[headerIdx])

  // カラムインデックスを取得
  const idxOrderId   = headers.findIndex(h => h.trim() === '注文 ID')
  const idxDate      = headers.findIndex(h => h.trim() === '注文日付')
  const idxSales     = headers.findIndex(h => h.trim() === '売上（消費税を含む）')
  const idxNetPayout = headers.findIndex(h => h.trim() === '合計支払い額（消費税を含む）')

  if (idxDate === -1 || idxSales === -1) {
    return []
  }

  // 日付ごとに集計
  const byDate: Record<string, DaySummary> = {}

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCsvLine(line)
    if (cols.length < 5) continue

    const orderId = cols[idxOrderId]?.trim() ?? ''
    // #で始まる行（実注文）のみ集計（ヘッダー・合計行を除外）
    if (!orderId.startsWith('#')) continue

    // 日付変換: YYYY/M/D → YYYY-MM-DD
    const rawDate = cols[idxDate]?.trim() ?? ''
    const date = convertDate(rawDate)
    if (!date) continue

    const sales     = parseNum(cols[idxSales])
    const netPayout = idxNetPayout >= 0 ? parseNum(cols[idxNetPayout]) : 0

    if (!byDate[date]) {
      byDate[date] = { date, orders: 0, sales: 0, netPayout: 0 }
    }
    byDate[date].orders++
    byDate[date].sales     += sales
    byDate[date].netPayout += netPayout
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
          hint: 'Uber Eats Manager の「お支払いの詳細」レポートCSVを使用してください',
        },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const updated: string[] = []
    const errors: string[] = []

    for (const row of rows) {
      const { error } = await db
        .from('daily_sales')
        .upsert(
          {
            tenant_id:   TENANT_ID,
            date:        row.date,
            uber_sales:  row.sales,
            uber_orders: row.orders,
          },
          { onConflict: 'tenant_id,date', ignoreDuplicates: false }
        )

      if (error) {
        errors.push(`${row.date}: ${error.message}`)
      } else {
        updated.push(row.date)
      }
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
