export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sync-status
 * AnyDeli 同期の完了状況を返す
 * → sync_completed_at >= sync_requested_at なら完了
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { data, error } = await db
      .from('tenants')
      .select('sync_requested_at, sync_completed_at')
      .eq('id', TENANT_ID)
      .single()

    if (error) throw error

    const reqAt  = data?.sync_requested_at ? new Date(data.sync_requested_at).getTime() : 0
    const doneAt = data?.sync_completed_at ? new Date(data.sync_completed_at).getTime() : 0

    const completed = reqAt > 0 && doneAt >= reqAt

    return NextResponse.json({
      requested_at:  data?.sync_requested_at ?? null,
      completed_at:  data?.sync_completed_at ?? null,
      completed,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
