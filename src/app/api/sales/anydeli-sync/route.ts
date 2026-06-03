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
    // JST時刻。15:00〜20:59 の同期は「昼締め」窓とみなし、店頭昼を固定スナップショットする。
    const jstHour = Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 3_600_000) % 24
    const isLunchWindow = jstHour >= 15 && jstHour < 21
    const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

    for (const row of rows) {
      // 既存値を取得（0上書き防止・店頭昼の固定判定に使用）
      const { data: existing } = await db
        .from('daily_sales')
        .select('store_sales, store_lunch_sales')
        .eq('tenant_id', TENANT_ID)
        .eq('date', row.date)
        .maybeSingle()
      const existingStore = Number(existing?.store_sales ?? 0)

      const upsertPayload: Record<string, unknown> = {
        tenant_id:         TENANT_ID,
        date:              row.date,
        anydeli_synced_at: now,
        data_source:       'api',
      }

      // ── バグ修正1: ¥0 で既存の正の店頭売上を上書きしない ──
      // AnyDeliのスクレイプが失敗/空で 0 を返すことがあり、それで店頭を消していた。
      // 新値が正、または既存が無い(0)時のみ更新する。
      if (row.amount > 0 || existingStore === 0) {
        upsertPayload.anydeli_sales  = row.amount
        upsertPayload.anydeli_orders = row.orders
        upsertPayload.store_sales    = row.amount   // total_sales = store + delivery に乗る
        upsertPayload.store_orders   = row.orders
        // 現金/オンライン内訳も正値のときだけ
        if (row.cash_sales   !== undefined) upsertPayload.anydeli_cash_sales   = row.cash_sales
        if (row.online_sales !== undefined) upsertPayload.anydeli_online_sales = row.online_sales
      }

      // ── バグ修正2: 店頭昼は「窓内の初回同期」で固定し、以降は上書きしない ──
      // 以前は窓内(15〜20時JST)の毎回の同期で店頭昼が更新され、昼が夜寄りに膨らんでいた。
      // store_lunch_sales が未設定(null)のときだけ初回値を固定する。
      if (isLunchWindow && row.date === todayJst && row.amount > 0
          && existing?.store_lunch_sales == null) {
        upsertPayload.store_lunch_sales = row.amount
      }

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
