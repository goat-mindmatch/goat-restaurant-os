export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/sync-google-reviews
 * Places API (New) で店舗の口コミ数・レビューを取得し、
 * 前回から増えたぶんを直近クリックに自動紐付け。
 *
 * 必要な環境変数:
 *   GOOGLE_PLACES_API_KEY   - Google Cloud Places API (New) の APIキー
 *   NEXT_PUBLIC_GOOGLE_PLACE_ID   - 店舗の Place ID（既に設定済）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendCustomerLineMessage } from '@/lib/line-customer'
import { sendLineMessage as sendStaffLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET
const PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID
const API_KEY = process.env.GOOGLE_PLACES_API_KEY

type GoogleReview = {
  name?: string                 // unique ID
  relativePublishTimeDescription?: string
  rating?: number
  text?: { text?: string; languageCode?: string }
  originalText?: { text?: string; languageCode?: string }
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string }
  publishTime?: string
}

type PlaceDetails = {
  userRatingCount?: number
  rating?: number
  reviews?: GoogleReview[]
}

async function fetchPlaceDetails(): Promise<PlaceDetails | null> {
  if (!PLACE_ID || !API_KEY) return null

  const url = `https://places.googleapis.com/v1/places/${PLACE_ID}`
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'id,displayName,userRatingCount,rating,reviews',
    },
  })
  if (!res.ok) {
    console.error('Places API failed', await res.text())
    return null
  }
  return await res.json()
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    if (!PLACE_ID || !API_KEY) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: 'GOOGLE_PLACES_API_KEY or PLACE_ID not set',
      })
    }

    const place = await fetchPlaceDetails()
    if (!place) {
      return NextResponse.json({ ok: false, error: 'Places API fetch failed' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 前回カウント取得
    const { data: lastRow } = await db.from('google_review_count_history')
      .select('count, checked_at')
      .eq('tenant_id', TENANT_ID)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentCount = place.userRatingCount ?? 0
    const previousCount = lastRow?.count ?? 0
    // 初回実行時（履歴なし）はベースライン作成のみ。差分 → 0
    const isFirstRun = !lastRow
    const delta = isFirstRun ? 0 : Math.max(0, currentCount - previousCount)

    // カウント履歴を記録
    await db.from('google_review_count_history').insert({
      tenant_id: TENANT_ID,
      count: currentCount,
      rating: place.rating ?? null,
      checked_at: new Date().toISOString(),
    })

    // サンプルレビュー5件をキャッシュに保存
    const { data: cached } = await db.from('google_reviews_cache')
      .select('review_id').eq('tenant_id', TENANT_ID)
    const cachedIds = new Set((cached ?? []).map((r: { review_id: string }) => r.review_id))

    let newCached = 0
    for (const gr of place.reviews ?? []) {
      if (!gr.name || cachedIds.has(gr.name)) continue
      const reviewText = gr.text?.text ?? gr.originalText?.text ?? null
      await db.from('google_reviews_cache').insert({
        tenant_id: TENANT_ID,
        review_id: gr.name,
        reviewer_name: gr.authorAttribution?.displayName ?? null,
        star_rating: String(gr.rating ?? ''),
        comment: reviewText,
        created_time: gr.publishTime ?? new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      })
      newCached++
    }

    // 増分に応じて、未検証クリックを自動承認（直近から順に）
    let autoVerified = 0
    if (delta > 0) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data: pending } = await db.from('reviews')
        .select('id, staff_id, customer_line_user_id, note')
        .eq('tenant_id', TENANT_ID)
        .is('verified_at', null)
        .gte('clicked_at', since)
        .order('clicked_at', { ascending: false })
        .limit(delta)

      for (const p of pending ?? []) {
        await db.from('reviews').update({
          verified_at: new Date().toISOString(),
          note: `${p.note ?? ''} | auto-verified-by-places-api`,
        }).eq('id', p.id)
        autoVerified++

        // 顧客LINEへ通知
        if (p.customer_line_user_id) {
          const couponMatch = String(p.note ?? '').match(/coupon:([A-Z0-9-]+)/)
          const couponCode = couponMatch?.[1] ?? 'MZ-OK'
          try {
            await sendCustomerLineMessage(p.customer_line_user_id,
              `🎉 口コミありがとうございました！\n\nGoogle上で投稿を確認しました。\n\n【特典コード】\n${couponCode}\n\n次回ご来店時にこの画面をスタッフにお見せください🙌`)
          } catch (e) {
            console.error('customer notify failed', e)
          }
        }
      }
    }

    // 管理者に日次レポート
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID).eq('role', 'manager')
      .not('line_user_id', 'is', null)

    for (const m of managers ?? []) {
      try {
        await sendStaffLineMessage(m.line_user_id,
          `📊 Google口コミ同期\n\n総件数: ${currentCount}件（前回比 +${delta}）\n平均評価: ★${place.rating ?? '-'}\n自動検証: ${autoVerified}件`)
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      is_first_run: isFirstRun,
      current_count: currentCount,
      previous_count: previousCount,
      delta,
      auto_verified: autoVerified,
      new_cached_reviews: newCached,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
