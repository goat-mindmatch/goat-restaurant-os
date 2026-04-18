export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/menu/orders
 * アクティブな注文一覧を返す（今日分・confirmed/pending/cooking/ready）
 * クエリ: ?status=pending (現在未使用・将来拡張用)
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const today = new Date().toISOString().split('T')[0]

    const { data: orders, error } = await db
      .from('customer_orders')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .in('status', ['confirmed', 'pending', 'cooking', 'ready'])
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ orders: orders ?? [] })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
