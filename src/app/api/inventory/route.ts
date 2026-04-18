export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/inventory          - 在庫一覧取得
 * POST /api/inventory          - 在庫品目追加
 * PUT  /api/inventory          - 在庫数量更新（入荷・消費・調整）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('inventory_items')
      .select('*, supplier:suppliers(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('category')
      .order('name')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, category, unit, current_stock, min_stock, supplier_id, note } = body
    if (!name || !unit) return NextResponse.json({ error: 'name/unit required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db.from('inventory_items').insert({
      tenant_id:     TENANT_ID,
      name,
      category:      category ?? 'food',
      unit,
      current_stock: Number(current_stock) || 0,
      min_stock:     Number(min_stock) || 0,
      supplier_id:   supplier_id ?? null,
      note:          note ?? null,
    }).select().single()
    if (error) throw error
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { item_id, change_amount, reason, note } = body
    if (!item_id || change_amount === undefined) {
      return NextResponse.json({ error: 'item_id and change_amount required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 現在の在庫を取得
    const { data: item, error: fetchErr } = await db
      .from('inventory_items')
      .select('name, unit, current_stock, min_stock')
      .eq('id', item_id)
      .eq('tenant_id', TENANT_ID)
      .single()
    if (fetchErr || !item) return NextResponse.json({ error: 'item not found' }, { status: 404 })

    const newStock = Math.max(0, Number(item.current_stock) + Number(change_amount))

    // 在庫を更新
    const { error: updateErr } = await db
      .from('inventory_items')
      .update({ current_stock: newStock, last_updated: new Date().toISOString() })
      .eq('id', item_id)
      .eq('tenant_id', TENANT_ID)
    if (updateErr) throw updateErr

    // ログを記録
    await db.from('inventory_logs').insert({
      tenant_id:     TENANT_ID,
      item_id,
      change_amount: Number(change_amount),
      reason:        reason ?? 'adjustment',
      note:          note ?? null,
    })

    // 在庫アラート（閾値以下になった場合）
    if (newStock <= Number(item.min_stock) && Number(item.min_stock) > 0) {
      try {
        const { data: managers } = await db
          .from('staff')
          .select('line_user_id')
          .eq('tenant_id', TENANT_ID)
          .eq('role', 'manager')
          .eq('is_active', true)
          .not('line_user_id', 'is', null)

        for (const m of managers ?? []) {
          await sendLineMessage(
            m.line_user_id,
            `⚠️ 在庫アラート\n\n「${item.name}」の在庫が少なくなっています。\n\n現在: ${newStock}${item.unit}\n発注目安: ${item.min_stock}${item.unit}\n\n早めに発注をご確認ください。`
          ).catch(() => {})
        }
      } catch {}
    }

    return NextResponse.json({ ok: true, new_stock: newStock, alert: newStock <= Number(item.min_stock) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const item_id = searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('inventory_items')
      .update({ is_active: false })
      .eq('id', item_id)
      .eq('tenant_id', TENANT_ID)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
