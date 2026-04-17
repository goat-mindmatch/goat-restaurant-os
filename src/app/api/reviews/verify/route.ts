export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/reviews/verify?code=XXX - 検証コードから詳細取得
 * POST /api/reviews/verify - 承認/却下
 * body: { review_id, action: 'approve' | 'reject', staff_line_user_id? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

// ================================
// GET: 検証コードから情報取得
// ================================
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 専用カラムで検索（staff_id→staffの関連を明示）
    const { data: rows } = await db.from('reviews')
      .select('id, staff_id, clicked_at, completed, completed_at, verified_at, verified_by, review_text, staff:staff!reviews_staff_id_fkey(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('coupon_code', code)
      .limit(1)

    const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null

    if (!data) {
      return NextResponse.json({ error: 'コードが見つかりません' }, { status: 404 })
    }

    // 検証者の名前を別途取得
    let verifierName: string | null = null
    if (data.verified_by) {
      const { data: verifier } = await db.from('staff')
        .select('name').eq('id', data.verified_by).maybeSingle()
      verifierName = verifier?.name ?? null
    }

    return NextResponse.json({
      review_id: data.id,
      staff_name: data.staff?.name ?? '指名なし',
      clicked_at: data.clicked_at,
      completed: data.completed,
      completed_at: data.completed_at,
      verified_at: data.verified_at,
      verified_by_name: verifierName,
      review_text: data.review_text ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// ================================
// POST: 承認・却下
// ================================
export async function POST(req: NextRequest) {
  try {
    const { review_id, action, staff_line_user_id } = await req.json()
    if (!review_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'invalid params' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 検証したスタッフを特定
    let verifiedBy: string | null = null
    if (staff_line_user_id) {
      const { data: s } = await db.from('staff')
        .select('id').eq('line_user_id', staff_line_user_id).single()
      verifiedBy = s?.id ?? null
    }

    if (action === 'approve') {
      // レビュー情報を取得（LINE通知用）
      const { data: reviewData } = await db.from('reviews')
        .select('coupon_code, customer_line_user_id')
        .eq('id', review_id).single()

      await db.from('reviews').update({
        verified_at: new Date().toISOString(),
        verified_by: verifiedBy,
      }).eq('id', review_id).eq('tenant_id', TENANT_ID)

      // 承認後：お客様のLINEにクーポンカードを自動送信
      if (reviewData?.customer_line_user_id && reviewData?.coupon_code) {
        try {
          const { sendCouponFlex } = await import('@/lib/line-staff')
          await sendCouponFlex(reviewData.customer_line_user_id, reviewData.coupon_code)
        } catch (e) {
          console.error('Flex coupon notification failed:', e)
        }
      }
    } else {
      await db.from('reviews').update({
        verified_at: null,
        verified_by: verifiedBy,
        note: `coupon:rejected-by-${verifiedBy ?? 'unknown'}`,
      }).eq('id', review_id).eq('tenant_id', TENANT_ID)
    }

    return NextResponse.json({ ok: true, action })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
