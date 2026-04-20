export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

/**
 * PUT /api/tasks/[id]
 * body: { completed: boolean }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { id } = await params
  const body = await req.json()
  const { completed } = body

  const { data, error } = await db
    .from('task_logs')
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('tenant_id', TENANT_ID)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/tasks/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { id } = await params

  const { error } = await db
    .from('task_logs')
    .delete()
    .eq('id', id)
    .eq('tenant_id', TENANT_ID)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
