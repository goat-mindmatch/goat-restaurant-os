export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/click
 * 口コミ投稿前の「スタッフ指名クリック」を記録
 * body: { staff_id, customer_line_user_id? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { staff_id, customer_line_user_id } = await req.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 'nominee'（指名なし）の場合は staff_id を null に
    const realStaffId = staff_id === 'nominee' ? null : staff_id

    const { error } = await db.from('reviews').insert({
      tenant_id: TENANT_ID,
      staff_id: realStaffId,
      customer_line_user_id: customer_line_user_id ?? null,
      clicked_at: new Date().toISOString(),
      completed: false,
    })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
