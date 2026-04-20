import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

/**
 * GET /api/tables/call?status=pending
 * 指定ステータスの呼び出し一覧を返す
 */
export async function GET(req: NextRequest) {
  const db = createServiceClient() as any
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

  const { data, error } = await db
    .from('table_calls')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/tables/call
 * body: { table_number, table_name?, call_type: 'staff'|'water'|'bill' }
 * → table_calls に INSERT
 * → 未対応が5件以上あればアラート情報を付与
 */
export async function POST(req: NextRequest) {
  const db = createServiceClient() as any
  const body = await req.json()
  const { table_number, table_name, call_type = 'staff' } = body

  if (!table_number) {
    return NextResponse.json({ error: 'table_number is required' }, { status: 400 })
  }

  if (!['staff', 'water', 'bill'].includes(call_type)) {
    return NextResponse.json({ error: 'invalid call_type' }, { status: 400 })
  }

  const { data, error } = await db
    .from('table_calls')
    .insert({
      tenant_id: TENANT_ID,
      table_number,
      table_name: table_name ?? null,
      call_type,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 未対応の呼び出し件数を確認（将来拡張用アラート）
  const { count } = await db
    .from('table_calls')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'pending')

  const pendingCount = count ?? 0
  const alert = pendingCount >= 5
    ? `未対応の呼び出しが${pendingCount}件あります`
    : null

  return NextResponse.json({ ok: true, id: data.id, pending_count: pendingCount, alert })
}

/**
 * PUT /api/tables/call  (対応済みに更新)
 * body: { id }
 */
export async function PUT(req: NextRequest) {
  const db = createServiceClient() as any
  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('table_calls')
    .update({ status: 'responded', responded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', TENANT_ID)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
