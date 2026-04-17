export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews/pending
 * 確認待ち（completed=true, verified_at=null）のレビュー一覧
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { data } = await db.from('reviews')
      .select('id, clicked_at, completed, coupon_code, customer_line_user_id, screenshot_verdict, staff:staff!reviews_staff_id_fkey(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('completed', true)
      .is('verified_at', null)
      .order('clicked_at', { ascending: false })
      .limit(20)

    const reviews = (data ?? []).map((r: {
      id: string
      clicked_at: string
      coupon_code: string | null
      customer_line_user_id: string | null
      screenshot_verdict: string | null
      staff: { name: string } | null
    }) => ({
      id: r.id,
      staff_name: r.staff?.name ?? '指名なし',
      clicked_at: r.clicked_at,
      coupon_code: r.coupon_code,
      customer_line_user_id: r.customer_line_user_id,
      screenshot_verdict: r.screenshot_verdict,
    }))

    return NextResponse.json({ reviews })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, reviews: [] }, { status: 500 })
  }
}
