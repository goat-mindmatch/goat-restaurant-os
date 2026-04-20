export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/staff        — スタッフ一覧
 * POST /api/staff        — スタッフ追加 / 更新 / 無効化
 *   body.action === 'update'     → 編集
 *   body.action === 'deactivate' → 退職（is_active=false）
 *   それ以外                     → 新規追加
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('staff')
      .select('id, name, role, hourly_wage, transport_fee, is_active, line_user_id')
      .eq('tenant_id', TENANT_ID)
      .order('is_active', { ascending: false })
      .order('name')

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    const message = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 退職処理（論理削除）
    if (body.action === 'deactivate' && body.id) {
      const { error } = await db
        .from('staff')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', body.id)
        .eq('tenant_id', TENANT_ID)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // 更新
    if (body.action === 'update' && body.id) {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
      }
      const { error } = await db
        .from('staff')
        .update({
          name:          String(body.name).trim(),
          role:          body.role          ?? 'staff',
          hourly_wage:   body.hourly_wage   ? Number(body.hourly_wage)   : null,
          transport_fee: body.transport_fee ? Number(body.transport_fee) : 0,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', body.id)
        .eq('tenant_id', TENANT_ID)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // 新規追加
    const { name, role, hourly_wage, transport_fee } = body
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
    }
    const { data, error } = await db
      .from('staff')
      .insert({
        tenant_id:     TENANT_ID,
        name:          name.trim(),
        role:          role          ?? 'staff',
        hourly_wage:   Number(hourly_wage)   || 1100,
        transport_fee: Number(transport_fee) || 0,
        is_active:     true,
      })
      .select('id, name, role, hourly_wage, transport_fee, is_active, line_user_id')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
