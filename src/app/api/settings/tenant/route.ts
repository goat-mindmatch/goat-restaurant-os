export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/settings/tenant  — テナント設定取得
 * PATCH /api/settings/tenant — テナント設定更新（monthly_target, name）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('tenants')
      .select('id, name, monthly_target, change_fund')
      .eq('id', TENANT_ID)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const update: Record<string, string | number> = {}

    if (body.name           !== undefined) update.name           = String(body.name).trim()
    if (body.monthly_target !== undefined) update.monthly_target = Number(body.monthly_target)
    if (body.change_fund    !== undefined) update.change_fund    = Number(body.change_fund)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('tenants')
      .update(update)
      .eq('id', TENANT_ID)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
