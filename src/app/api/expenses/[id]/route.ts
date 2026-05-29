export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH  /api/expenses/[id]  → category / vendor / note / amount / date を編集
 * DELETE /api/expenses/[id]  → 経費レコード削除（OCR誤認等のリカバリ用）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

const VALID_CATEGORIES = new Set([
  'food', 'fuel', 'utility', 'consumable',
  'equipment', 'rent', 'communication', 'transport', 'other',
])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if (body.category !== undefined) {
      if (!VALID_CATEGORIES.has(body.category)) {
        return NextResponse.json({ error: `category must be one of: ${[...VALID_CATEGORIES].join(', ')}` }, { status: 400 })
      }
      updates.category = body.category
    }
    if (body.vendor !== undefined) updates.vendor = body.vendor || null
    if (body.note !== undefined) updates.note = body.note || null
    if (body.amount !== undefined) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
      }
      updates.amount = amount
    }
    if (body.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
      }
      updates.date = body.date
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no editable fields provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

    return NextResponse.json({ ok: true, expense: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
