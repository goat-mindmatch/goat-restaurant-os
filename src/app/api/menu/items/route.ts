export const dynamic = 'force-dynamic'

/**
 * GET    /api/menu/items  - メニュー一覧取得（全件、is_available問わず）
 * POST   /api/menu/items  - 商品追加
 * PUT    /api/menu/items  - 商品更新
 * DELETE /api/menu/items?id=xxx - 商品削除
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(_req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: items } = await db.from('menu_items')
    .select('id, name, description, price, category, image_url, sort_order, is_available, name_en, name_zh, description_en, description_zh')
    .eq('tenant_id', TENANT_ID)
    .order('sort_order')

  return NextResponse.json({ items: items ?? [] })
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const body = await req.json()
  const { name, description, price, category, image_url, sort_order } = body
  if (!name || price === undefined) {
    return NextResponse.json({ error: 'name/price required' }, { status: 400 })
  }
  const { data, error } = await db.from('menu_items').insert({
    tenant_id: TENANT_ID,
    name,
    description: description || null,
    price: Number(price),
    category: category || 'main',
    image_url: image_url || null,
    sort_order: sort_order ?? 999,
    is_available: true,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function PUT(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const body = await req.json()
  const { id, name, description, price, category, image_url, sort_order, is_available } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (description !== undefined) update.description = description
  if (price !== undefined) update.price = Number(price)
  if (category !== undefined) update.category = category
  if (image_url !== undefined) update.image_url = image_url
  if (sort_order !== undefined) update.sort_order = sort_order
  if (is_available !== undefined) update.is_available = is_available
  const { error } = await db.from('menu_items').update(update).eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('menu_items').delete().eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
