export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import CouponClient from './CouponClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function CouponPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: rows } = await db.from('reviews')
    .select('id, coupon_code, verified_at, used_at, clicked_at, staff:staff!reviews_staff_id_fkey(name)')
    .eq('tenant_id', TENANT_ID)
    .eq('coupon_code', code.toUpperCase())
    .limit(1)

  const review = rows?.[0] ?? null

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-4xl mb-4">❌</p>
          <p className="text-gray-700 font-medium">クーポンが見つかりません</p>
          <p className="text-xs text-gray-400 mt-2">コード: {code}</p>
        </div>
      </div>
    )
  }

  return (
    <CouponClient
      reviewId={review.id}
      couponCode={review.coupon_code}
      staffName={review.staff?.name ?? '指名なし'}
      verifiedAt={review.verified_at}
      usedAt={review.used_at}
      clickedAt={review.clicked_at}
    />
  )
}
