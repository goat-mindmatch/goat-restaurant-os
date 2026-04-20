export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/tables        - テーブル一覧 + 各テーブルのアクティブ注文状況
 * POST /api/tables        - テーブル追加 { name, table_number, capacity }
 * PUT  /api/tables        - テーブル更新 { id, name, capacity, is_active }
 * DELETE /api/tables?id=  - テーブル削除
 *
 * テーブル列: id(uuid), tenant_id(uuid), name(text), table_number(int),
 *             capacity(int), sort_order(int), is_active(bool), created_at
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: tables, error } = await db
    .from('tables')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 今日のアクティブ注文を取得
  const today = new Date().toISOString().split('T')[0]
  const { data: orders } = await db
    .from('customer_orders')
    .select('id, table_number, items, total_amount, payment_method, status, note, created_at')
    .eq('tenant_id', TENANT_ID)
    .in('status', ['pending', 'confirmed', 'cooking', 'ready', 'waiting_payment'])
    .gte('created_at', today + 'T00:00:00')

  // テーブルに注文を紐付け（table_number で照合）
  const result = (tables ?? []).map((t: Record<string, unknown>) => {
    const tableOrders = (orders ?? []).filter(
      (o: Record<string, unknown>) => Number(o.table_number) === Number(t.table_number)
    )
    const totalAmount = tableOrders.reduce(
      (s: number, o: Record<string, unknown>) => s + (Number(o.total_amount) || 0), 0
    )
    const hasWaiting = tableOrders.some(
      (o: Record<string, unknown>) => o.status === 'waiting_payment'
    )
    const isOccupied = tableOrders.length > 0

    return {
      ...t,
      orders: tableOrders,
      total_amount: totalAmount,
      order_count: tableOrders.length,
      status: hasWaiting ? 'waiting_payment' : isOccupied ? 'occupied' : 'empty',
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { name, table_number, capacity } = await req.json()
  if (!name || table_number === undefined) {
    return NextResponse.json({ error: 'name と table_number は必須です' }, { status: 400 })
  }

  // sort_order は現在の最大値 + 1
  const { data: maxRow } = await db
    .from('tables')
    .select('sort_order')
    .eq('tenant_id', TENANT_ID)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await db.from('tables').insert({
    tenant_id: TENANT_ID,
    name,
    table_number: Number(table_number),
    capacity: Number(capacity) || 4,
    sort_order: ((maxRow?.sort_order ?? 0) as number) + 1,
    is_active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, table: data })
}

export async function PUT(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const body = await req.json()
  const { id, name, table_number, capacity, is_active } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (name !== undefined)         update.name         = name
  if (table_number !== undefined) update.table_number = Number(table_number)
  if (capacity !== undefined)     update.capacity     = Number(capacity)
  if (is_active !== undefined)    update.is_active    = is_active

  const { error } = await db.from('tables').update(update)
    .eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('tables').delete().eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
