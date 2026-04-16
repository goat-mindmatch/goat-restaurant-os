export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/reviews/check?review_id=XXX
 * ローカルストレージ復元時に状態を確認するためのAPI
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  try {
    const reviewId = req.nextUrl.searchParams.get('review_id')
    if (!reviewId) return NextResponse.json({ error: 'review_id required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data } = await db.from('reviews')
      .select('id, completed, verified_at')
      .eq('tenant_id', TENANT_ID)
      .eq('id', reviewId)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ exists: false, completed: false })
    }
    return NextResponse.json({
      exists: true,
      completed: !!data.completed,
      verified: !!data.verified_at,
    })
  } catch {
    return NextResponse.json({ exists: false, completed: false })
  }
}
