export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/use-coupon
 * クーポンを使用済みにする（1回限り）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { review_id } = await req.json()
    if (!review_id) return NextResponse.json({ error: 'review_id required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { data: review } = await db.from('reviews')
      .select('id, verified_at, used_at')
      .eq('id', review_id)
      .eq('tenant_id', TENANT_ID)
      .single()

    if (!review) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (!review.verified_at) return NextResponse.json({ error: 'not yet verified' }, { status: 400 })
    if (review.used_at) return NextResponse.json({ error: 'already used' }, { status: 400 })

    await db.from('reviews').update({
      used_at: new Date().toISOString(),
    }).eq('id', review_id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
