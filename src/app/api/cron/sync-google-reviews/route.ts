export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/sync-google-reviews
 * Google Business Profile API から新しい口コミを取得し、
 * 直近クリック済みのレビューに自動で verified_at を付与する。
 *
 * 前提環境変数（Google Cloud Console で準備）:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REFRESH_TOKEN
 *   GOOGLE_BUSINESS_ACCOUNT_ID   (accounts/XXXX)
 *   GOOGLE_BUSINESS_LOCATION_ID  (locations/YYYY)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendCustomerLineMessage } from '@/lib/line-customer'
import { sendLineMessage as sendStaffLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET

// ======================================================
// Google OAuth: refresh_token から access_token を取得
// ======================================================
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    console.error('Google token refresh failed', await res.text())
    return null
  }
  const json = await res.json()
  return json.access_token as string
}

// ======================================================
// Business Profile API から口コミ一覧取得
// ======================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGoogleReviews(accessToken: string): Promise<any[]> {
  const account = process.env.GOOGLE_BUSINESS_ACCOUNT_ID
  const location = process.env.GOOGLE_BUSINESS_LOCATION_ID
  if (!account || !location) return []

  const url = `https://mybusiness.googleapis.com/v4/${account}/${location}/reviews`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    console.error('Google reviews fetch failed', await res.text())
    return []
  }
  const json = await res.json()
  return json.reviews ?? []
}

// ======================================================
// メインハンドラ
// ======================================================
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: 'Google OAuth credentials not configured',
      })
    }

    const googleReviews = await fetchGoogleReviews(accessToken)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 既に取り込み済みの Google review IDs を取得
    const { data: synced } = await db.from('google_reviews_cache')
      .select('review_id').eq('tenant_id', TENANT_ID)
    const syncedIds = new Set((synced ?? []).map((r: { review_id: string }) => r.review_id))

    let autoVerified = 0
    const newReviews: string[] = []

    for (const gr of googleReviews) {
      if (syncedIds.has(gr.reviewId)) continue

      newReviews.push(gr.reviewId)

      // 取り込みキャッシュ
      await db.from('google_reviews_cache').insert({
        tenant_id: TENANT_ID,
        review_id: gr.reviewId,
        reviewer_name: gr.reviewer?.displayName ?? null,
        star_rating: gr.starRating ?? null,
        comment: gr.comment ?? null,
        created_time: gr.createTime ?? new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      })

      // 直近1日以内の未検証クリックを自動マッチング
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: pendingRows } = await db.from('reviews')
        .select('id, staff_id, customer_line_user_id, note')
        .eq('tenant_id', TENANT_ID)
        .is('verified_at', null)
        .gte('clicked_at', since)
        .order('clicked_at', { ascending: false })
        .limit(1)

      const pending = (pendingRows ?? [])[0]
      if (pending) {
        await db.from('reviews').update({
          verified_at: new Date().toISOString(),
          note: `${pending.note ?? ''} | auto-verified:${gr.reviewId}`,
        }).eq('id', pending.id)
        autoVerified++

        // 顧客LINEに通知（customer_line_user_id があり、顧客LINEが設定されていれば）
        if (pending.customer_line_user_id) {
          const couponCode = (pending.note ?? '').replace('coupon:', '').trim()
          try {
            await sendCustomerLineMessage(pending.customer_line_user_id,
              `🎉 口コミありがとうございました！\n\nGoogle上で投稿を確認しました。\n\n【確認コード】\n${couponCode}\n\n次回ご来店時にこの画面をスタッフへお見せください。特典をお渡しします🙌`
            )
          } catch (e) {
            console.error('Failed to notify customer:', e)
          }
        }
      }
    }

    // 管理者に日次レポート（何件自動検証したか）
    if (newReviews.length > 0) {
      const { data: managers } = await db.from('staff')
        .select('line_user_id, name')
        .eq('tenant_id', TENANT_ID).eq('role', 'manager')
        .not('line_user_id', 'is', null)
      for (const m of managers ?? []) {
        await sendStaffLineMessage(m.line_user_id,
          `📊 Google口コミ同期完了\n新規: ${newReviews.length}件\n自動検証: ${autoVerified}件`)
          .catch(() => {})
      }
    }

    return NextResponse.json({
      ok: true,
      total_google_reviews: googleReviews.length,
      new_reviews: newReviews.length,
      auto_verified: autoVerified,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
