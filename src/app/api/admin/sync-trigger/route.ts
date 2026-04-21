export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-trigger
 * AnyDeli の手動同期をリクエストする
 * → tenants.sync_requested_at を更新
 * → ローカルの sync-poller.js が 60 秒以内に検知してスクレイパーを起動
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
      .update({ sync_requested_at: now })
      .eq('id', TENANT_ID)

    if (error) throw error

    return NextResponse.json({
      ok:           true,
      requested_at: now,
      message:      '同期リクエストを送信しました。60秒以内に自動取込が実行されます。',
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
