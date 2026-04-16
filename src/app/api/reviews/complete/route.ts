export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/complete
 * 「書きました」ボタンタップ時に呼ばれる
 * body: { review_id? or (uid + staff_id) }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

// 簡易クーポンコード生成（日付 + ランダム4文字）
function generateCouponCode(): string {
  const d = new Date()
  const ym = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MZ${ym}-${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const { review_id, uid, staff_id } = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    let review

    if (review_id) {
      const { data } = await db.from('reviews')
        .select('id, staff_id, completed, staff(name)')
        .eq('id', review_id).eq('tenant_id', TENANT_ID).single()
      review = data
    } else if (uid) {
      // 直近30分以内の未完了クリックを検索
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const query = db.from('reviews')
        .select('id, staff_id, completed, staff(name)')
        .eq('tenant_id', TENANT_ID)
        .eq('customer_line_user_id', uid)
        .eq('completed', false)
        .gte('clicked_at', since)
        .order('clicked_at', { ascending: false })
        .limit(1)
      const { data } = await query.maybeSingle()
      review = data
    }

    if (!review) {
      return NextResponse.json({ error: '対象の口コミクリックが見つかりません' }, { status: 404 })
    }

    if (review.completed) {
      return NextResponse.json({ ok: true, alreadyCompleted: true, staff_name: review.staff?.name ?? null })
    }

    const couponCode = generateCouponCode()

    await db.from('reviews').update({
      completed: true,
      completed_at: new Date().toISOString(),
      note: `coupon:${couponCode}`,
    }).eq('id', review.id)

    return NextResponse.json({
      ok: true,
      staff_name: review.staff?.name ?? null,
      coupon_code: couponCode,
      review_id: review.id,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
