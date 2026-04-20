export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/staff  — スタッフ一覧（全員）
 * POST /api/staff  — スタッフ新規追加
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
      .select('id, name, role, hourly_wage, transport_fee, is_active')
      .eq('tenant_id', TENANT_ID)
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
    const { name, role, hourly_wage, transport_fee } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('staff')
      .insert({
        tenant_id:     TENANT_ID,
        name:          name.trim(),
        role:          role ?? 'staff',
        hourly_wage:   Number(hourly_wage)   || 1100,
        transport_fee: Number(transport_fee) || 0,
        is_active:     true,
      })
      .select('id, name, role, hourly_wage, transport_fee, is_active')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
