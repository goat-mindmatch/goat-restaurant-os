export const dynamic = 'force-dynamic'

/**
 * GET  /api/cash/register?date=YYYY-MM-DD  現金精算データ取得
 * POST /api/cash/register                  照合結果を保存
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 当日の売上データ取得
    const { data: sales, error: salesErr } = await db
      .from('daily_sales')
      .select('anydeli_sales, anydeli_cash_sales, anydeli_online_sales, anydeli_orders, cash_register_actual, cash_register_diff, cash_register_checked_at, cash_register_photo_url')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .single()

    if (salesErr && salesErr.code !== 'PGRST116') throw salesErr

    // テナント設定（つり銭準備金）
    const { data: tenant } = await db
      .from('tenants')
      .select('change_fund, name')
      .eq('id', TENANT_ID)
      .single()

    const changeFund   = Number(tenant?.change_fund ?? 100000)
    const cashSales    = Number(sales?.anydeli_cash_sales ?? 0)
    const onlineSales  = Number(sales?.anydeli_online_sales ?? 0)
    const totalSales   = Number(sales?.anydeli_sales ?? 0)
    const expectedTotal = changeFund + cashSales  // レジ内想定金額

    return NextResponse.json({
      date,
      change_fund:      changeFund,
      cash_sales:       cashSales,
      online_sales:     onlineSales,
      total_sales:      totalSales,
      anydeli_orders:   Number(sales?.anydeli_orders ?? 0),
      expected_total:   expectedTotal,              // つり銭準備金 + 現金売上
      // 照合済みデータ（あれば）
      checked: sales?.cash_register_checked_at ? {
        actual:     Number(sales.cash_register_actual ?? 0),
        diff:       Number(sales.cash_register_diff   ?? 0),
        checked_at: sales.cash_register_checked_at,
        photo_url:  sales.cash_register_photo_url,
      } : null,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      date:       string
      actual:     number   // 実際のレジ内金額（AI読み取り）
      photo_url?: string   // 写真URL（オプション）
    }

    if (!body.date || body.actual === undefined) {
      return NextResponse.json({ error: 'date と actual が必要です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // expected_total を計算するためデータ取得
    const { data: sales } = await db
      .from('daily_sales')
      .select('anydeli_cash_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', body.date)
      .single()

    const { data: tenant } = await db
      .from('tenants')
      .select('change_fund')
      .eq('id', TENANT_ID)
      .single()

    const changeFund    = Number(tenant?.change_fund ?? 100000)
    const cashSales     = Number(sales?.anydeli_cash_sales ?? 0)
    const expectedTotal = changeFund + cashSales
    const diff          = body.actual - expectedTotal

    const now = new Date().toISOString()

    const { error } = await db
      .from('daily_sales')
      .upsert({
        tenant_id:                  TENANT_ID,
        date:                       body.date,
        cash_register_actual:       body.actual,
        cash_register_diff:         diff,
        cash_register_checked_at:   now,
        ...(body.photo_url ? { cash_register_photo_url: body.photo_url } : {}),
      }, { onConflict: 'tenant_id,date', ignoreDuplicates: false })

    if (error) throw error

    return NextResponse.json({
      ok:             true,
      date:           body.date,
      actual:         body.actual,
      expected:       expectedTotal,
      diff,
      diff_label:     diff === 0 ? '一致' : diff > 0 ? `+¥${Math.abs(diff).toLocaleString()} 過剰` : `-¥${Math.abs(diff).toLocaleString()} 不足`,
      checked_at:     now,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
