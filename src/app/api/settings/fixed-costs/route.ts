export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/settings/fixed-costs  - 固定費一覧取得
 * POST /api/settings/fixed-costs  - 固定費追加
 * PUT  /api/settings/fixed-costs  - 固定費更新（body: {id, amount, label, category, is_active}）
 * DELETE /api/settings/fixed-costs?id=xxx - 固定費削除
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  const db = createServiceClient() as any
  const { data, error } = await db
    .from('fixed_costs')
    .select('id, category, amount, label, is_active')
    .eq('tenant_id', TENANT_ID)
    .order('category')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = createServiceClient() as any
  const body = await req.json()
  const { category, amount, label } = body
  if (!category || !amount) return NextResponse.json({ error: 'category/amount required' }, { status: 400 })
  const { data, error } = await db.from('fixed_costs').insert({
    tenant_id: TENANT_ID,
    category,
    amount: Number(amount),
    label: label || null,
    is_active: true,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function PUT(req: NextRequest) {
  const db = createServiceClient() as any
  const body = await req.json()
  const { id, amount, label, category, is_active } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const update: Record<string, unknown> = {}
  if (amount !== undefined) update.amount = Number(amount)
  if (label !== undefined) update.label = label
  if (category !== undefined) update.category = category
  if (is_active !== undefined) update.is_active = is_active
  const { error } = await db.from('fixed_costs').update(update).eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const db = createServiceClient() as any
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db.from('fixed_costs').delete().eq('id', id).eq('tenant_id', TENANT_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
