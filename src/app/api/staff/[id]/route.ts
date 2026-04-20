export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/staff/:id — スタッフ情報更新（時給・交通費・有効フラグ・名前・役職）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { hourly_wage, transport_fee, is_active, name, role } = body

    const update: Record<string, string | number | boolean> = {}
    if (hourly_wage   !== undefined) update.hourly_wage   = Number(hourly_wage)
    if (transport_fee !== undefined) update.transport_fee = Number(transport_fee)
    if (is_active     !== undefined) update.is_active     = Boolean(is_active)
    if (name          !== undefined) update.name          = String(name).trim()
    if (role          !== undefined) update.role          = String(role)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db.from('staff')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
