export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/manual
 * 1日分の売上を手動登録（媒体別対応版）
 * body: {
 *   date, store_sales, store_orders,
 *   uber_sales, uber_orders,
 *   rocketnow_sales, rocketnow_orders,
 *   menu_sales, menu_orders,
 *   food_cost?
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      date,
      store_sales, store_orders,
      lunch_sales, lunch_orders,
      dinner_sales, dinner_orders,
      uber_sales, uber_orders,
      rocketnow_sales, rocketnow_orders,
      menu_sales, menu_orders,
      food_cost,
      cash_sales, card_sales, qr_sales,
      // 後方互換: delivery_sales / delivery_orders を直接渡された場合も受け付ける
      delivery_sales: legacyDelivery,
      delivery_orders: legacyDeliveryOrders,
    } = body

    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const uberS      = Number(uber_sales)       || 0
    const rocketnowS = Number(rocketnow_sales)  || 0
    const menuS      = Number(menu_sales)       || 0
    const uberO      = Number(uber_orders)      || 0
    const rocketnowO = Number(rocketnow_orders) || 0
    const menuO      = Number(menu_orders)      || 0

    // delivery_sales = 全デリバリー媒体の合計（total_sales の GENERATED 計算に使われる）
    const delivery_sales  = uberS + rocketnowS + menuS || Number(legacyDelivery) || 0
    const delivery_orders = uberO + rocketnowO + menuO || Number(legacyDeliveryOrders) || 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const upsertData: Record<string, unknown> = {
      tenant_id: TENANT_ID,
      date,
      store_sales:      Number(store_sales)  || 0,
      store_orders:     Number(store_orders) || 0,
      uber_sales:       uberS,
      uber_orders:      uberO,
      rocketnow_sales:  rocketnowS,
      rocketnow_orders: rocketnowO,
      menu_sales:       menuS,
      menu_orders:      menuO,
      delivery_sales,
      delivery_orders,
      food_cost: food_cost !== undefined ? Number(food_cost) : null,
      data_source: 'manual',
      updated_at: new Date().toISOString(),
    }
    // 昼夜別（入力がある場合のみ追加）
    if (lunch_sales !== undefined)  upsertData.lunch_sales   = Number(lunch_sales)   || 0
    if (lunch_orders !== undefined) upsertData.lunch_orders  = Number(lunch_orders)  || 0
    if (dinner_sales !== undefined) upsertData.dinner_sales  = Number(dinner_sales)  || 0
    if (dinner_orders !== undefined) upsertData.dinner_orders = Number(dinner_orders) || 0

    // 決済方法別（DBカラムが存在する場合のみ追加、存在しなくてもエラーにしない）
    if (cash_sales !== undefined) upsertData.cash_sales = Number(cash_sales) || 0
    if (card_sales !== undefined) upsertData.card_sales = Number(card_sales) || 0
    if (qr_sales   !== undefined) upsertData.qr_sales   = Number(qr_sales)   || 0

    // 決済方法別カラムが存在しない場合のフォールバック
    let upsertPayload = upsertData
    const { error } = await db.from('daily_sales').upsert(upsertPayload, { onConflict: 'tenant_id,date' })

    if (error) {
      // 決済方法別カラムが原因のエラーの場合は除外して再試行
      if (
        error.message?.includes('cash_sales') ||
        error.message?.includes('card_sales') ||
        error.message?.includes('qr_sales')
      ) {
        const { cash_sales: _c, card_sales: _cd, qr_sales: _q, ...fallbackData } = upsertPayload as any
        const { error: fallbackError } = await db.from('daily_sales').upsert(fallbackData, { onConflict: 'tenant_id,date' })
        if (fallbackError) throw fallbackError
      } else {
        throw error
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
