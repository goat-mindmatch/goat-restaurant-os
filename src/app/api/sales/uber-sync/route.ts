export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/uber-sync
 * Uber Eats CSVを貼り付け or アップロードして daily_sales に自動反映
 *
 * body: { csv: string, month?: string }
 * Uber Eatsのレポートは「日付,注文数,売上」形式のCSVを想定
 *
 * GET /api/sales/uber-sync?secret=xxx
 * cronから毎朝6時に実行（将来的にUber Eats APIが使える場合はここを拡張）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type UberRow = {
  date: string
  orders: number
  amount: number
}

// CSVパース（Uber Eatsの「注文レポート」形式に対応）
// 想定フォーマット: 日付,注文数,合計金額（ヘッダー行あり）
function parseUberCsv(csv: string): UberRow[] {
  const lines = csv.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // ヘッダー行をスキップ
  const dataLines = lines.slice(1)
  const results: UberRow[] = []

  for (const line of dataLines) {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 3) continue

    // 日付を YYYY-MM-DD 形式に変換
    const rawDate = cols[0]
    let date = rawDate
    // MM/DD/YYYY 形式の場合
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const [m, d, y] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // YYYY/MM/DD 形式の場合
    else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
      const [y, m, d] = rawDate.split('/')
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    const orders = parseInt(cols[1].replace(/[^0-9]/g, '')) || 0
    const amount = parseInt(cols[2].replace(/[^0-9]/g, '')) || 0

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      results.push({ date, orders, amount })
    }
  }

  return results
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { csv } = body

    if (!csv) {
      return NextResponse.json({ error: 'csv is required' }, { status: 400 })
    }

    const rows = parseUberCsv(csv)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSVの形式が正しくありません', hint: '日付,注文数,売上金額 の形式で入力してください' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const updated: string[] = []
    const errors: string[] = []

    for (const row of rows) {
      // 既存レコードをUPSERT（uber_sales, uber_orders を更新）
      const { error } = await db
        .from('daily_sales')
        .upsert({
          tenant_id: TENANT_ID,
          date: row.date,
          uber_sales: row.amount,
          uber_orders: row.orders,
        }, {
          onConflict: 'tenant_id,date',
          ignoreDuplicates: false,
        })

      if (error) {
        errors.push(`${row.date}: ${error.message}`)
      } else {
        updated.push(row.date)
      }
    }

    return NextResponse.json({
      ok: true,
      updated: updated.length,
      errors,
      dates: updated,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GETはcron用（現状はサンプルレスポンスを返すstub）
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 将来: Uber Eats APIが使える場合はここで自動取込
  // 現状: 「手動CSVアップロードを使ってください」と返す
  return NextResponse.json({
    ok: true,
    message: 'Uber Eats API連携は申請中です。現在は /dashboard/sales からCSVを手動アップロードしてください。',
    manualUploadUrl: 'https://goat-restaurant-os.vercel.app/dashboard/sales/uber-import',
  })
}
