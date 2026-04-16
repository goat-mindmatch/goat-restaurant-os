export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/register
 * クリック + 確認コード発行を同時に行う（新シンプルフロー用）
 * body: { staff_id, customer_line_user_id? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

function generateCouponCode(): string {
  const d = new Date()
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MZ${md}-${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const { staff_id, customer_line_user_id } = await req.json()

    // 必須チェック（staff_id と customer_line_user_id のどちらかは必要）
    if (!staff_id && !customer_line_user_id) {
      return NextResponse.json({ error: 'staff_id or customer_line_user_id required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const realStaffId = staff_id === 'nominee' ? null : staff_id
    const couponCode = generateCouponCode()
    const now = new Date().toISOString()

    const { data, error } = await db.from('reviews').insert({
      tenant_id: TENANT_ID,
      staff_id: realStaffId,
      customer_line_user_id: customer_line_user_id ?? null,
      clicked_at: now,
      completed: true,         // クリックと同時に申告済み扱い
      completed_at: now,
      note: `coupon:${couponCode}`,
      // verified_at は null のまま（検証待ち）
    }).select('id').single()
    if (error) throw error

    return NextResponse.json({
      ok: true,
      review_id: data.id,
      coupon_code: couponCode,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
