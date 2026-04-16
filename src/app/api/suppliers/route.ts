export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/suppliers - 取引先一覧
 * POST /api/suppliers - 取引先追加
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data } = await db.from('suppliers')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('name')
  return NextResponse.json({ suppliers: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    if (body.id) {
      // 更新
      const { error } = await db.from('suppliers').update({
        name: body.name,
        contact_type: body.contact_type,
        contact_value: body.contact_value,
        note: body.note,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      }).eq('id', body.id).eq('tenant_id', TENANT_ID)
      if (error) throw error
    } else {
      // 新規
      const { error } = await db.from('suppliers').insert({
        tenant_id: TENANT_ID,
        name: body.name,
        contact_type: body.contact_type ?? 'line',
        contact_value: body.contact_value ?? '',
        note: body.note ?? '',
        is_active: true,
      })
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
