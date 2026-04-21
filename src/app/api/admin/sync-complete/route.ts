export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-complete
 * ローカルスクレイパーが同期完了後に呼び出すエンドポイント
 * tenants.sync_completed_at を更新する
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const now = new Date().toISOString()

    const { error } = await db
      .from('tenants')
      .update({ sync_completed_at: now })
      .eq('id', TENANT_ID)

    if (error) throw error

    return NextResponse.json({ ok: true, completed_at: now })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
