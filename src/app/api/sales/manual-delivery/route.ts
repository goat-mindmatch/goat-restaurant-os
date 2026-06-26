export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 手動デリバリー売上入力API（Uber / RocketNow / 店頭）
 * 新ポータルが自動取得不可になったため、現場が「確認して入力するだけ」で
 * 反映できるようにする。
 *
 * GET  /api/sales/manual-delivery?date=YYYY-MM-DD
 *   → その日の現在値（store/uber/rocketnow/anydeli/total）を返す（確認表示用）
 *
 * POST /api/sales/manual-delivery
 *   body: {
 *     date: 'YYYY-MM-DD',
 *     store_sales?: number, store_orders?: number,
 *     uber_sales?: number, uber_orders?: number,
 *     rocketnow_sales?: number, rocketnow_orders?: number
 *   }
 *   → 指定された媒体のみ更新（未指定は既存値を維持）
 *   → delivery_sales を再計算（total_sales は GENERATED カラムで自動計算）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date(Date.now() + 9 * 3600 * 1000).toISOString().split('T')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data } = await db
    .from('daily_sales')
    .select('date, store_sales, store_orders, anydeli_sales, anydeli_orders, uber_sales, uber_orders, rocketnow_sales, rocketnow_orders, delivery_sales, total_sales, uber_synced_at, rocketnow_synced_at')
    .eq('tenant_id', TENANT_ID)
    .eq('date', date)
    .maybeSingle()

  return NextResponse.json({
    date,
    current: data ?? {
      store_sales: 0, store_orders: 0,
      anydeli_sales: 0, anydeli_orders: 0,
      uber_sales: 0, uber_orders: 0,
      rocketnow_sales: 0, rocketnow_orders: 0,
      total_sales: 0,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const date = String(body.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const hasStore = body.store_sales !== undefined || body.store_orders !== undefined
    const hasUber = body.uber_sales !== undefined || body.uber_orders !== undefined
    const hasRocket = body.rocketnow_sales !== undefined || body.rocketnow_orders !== undefined
    if (!hasStore && !hasUber && !hasRocket) {
      return NextResponse.json({ error: 'store_* / uber_* / rocketnow_* のいずれかを指定してください' }, { status: 400 })
    }

    const num = (v: unknown): number => {
      const n = Math.round(Number(v))
      return Number.isFinite(n) && n >= 0 ? n : 0
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 既存値を取得して他媒体を保持
    const { data: existing } = await db
      .from('daily_sales')
      .select('store_sales, store_orders, anydeli_sales, anydeli_orders, uber_sales, uber_orders, rocketnow_sales, rocketnow_orders, menu_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .maybeSingle()

    const menuSales   = Number(existing?.menu_sales)   || 0
    const storeSales  = hasStore  ? num(body.store_sales)  : (Number(existing?.store_sales) || 0)
    const storeOrders = hasStore  ? num(body.store_orders) : (Number(existing?.store_orders) || 0)

    const uberSales      = hasUber   ? num(body.uber_sales)      : (Number(existing?.uber_sales) || 0)
    const uberOrders     = hasUber   ? num(body.uber_orders)     : (Number(existing?.uber_orders) || 0)
    const rocketnowSales = hasRocket ? num(body.rocketnow_sales) : (Number(existing?.rocketnow_sales) || 0)
    const rocketnowOrders= hasRocket ? num(body.rocketnow_orders): (Number(existing?.rocketnow_orders) || 0)

    const deliverySales = uberSales + rocketnowSales + menuSales
    const now = new Date().toISOString()

    const payload: Record<string, unknown> = {
      tenant_id:      TENANT_ID,
      date,
      store_sales:    storeSales,
      store_orders:   storeOrders,
      anydeli_sales:  storeSales,
      anydeli_orders: storeOrders,
      uber_sales:     uberSales,
      uber_orders:    uberOrders,
      rocketnow_sales:  rocketnowSales,
      rocketnow_orders: rocketnowOrders,
      delivery_sales: deliverySales,
      data_source:    'manual',
    }
    // 手動入力した媒体のみ synced_at を更新（ヘルスチェックの誤検知を防ぐ）
    if (hasUber)   payload.uber_synced_at = now
    if (hasRocket) payload.rocketnow_synced_at = now

    const { error } = await db
      .from('daily_sales')
      .upsert(payload, { onConflict: 'tenant_id,date', ignoreDuplicates: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 反映後の値を返す
    const { data: after } = await db
      .from('daily_sales')
      .select('date, store_sales, anydeli_sales, store_orders, anydeli_orders, uber_sales, uber_orders, rocketnow_sales, rocketnow_orders, delivery_sales, total_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .maybeSingle()

    return NextResponse.json({ ok: true, saved: after })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
