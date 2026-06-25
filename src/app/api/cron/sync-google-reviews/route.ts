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

  const url = `https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=ja`
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
  // Vercel Cron: Authorization ヘッダー or 管理ツール: ?secret= クエリの両方を受け付ける
  const auth = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  // notify=1 の回だけ経営者へpush（LINE無料枠節約のため1日1回＝夜の回だけ付与）
  const notify = req.nextUrl.searchParams.get('notify') === '1'
  const isAuthorized =
    !CRON_SECRET ||
    auth === `Bearer ${CRON_SECRET}` ||
    querySecret === CRON_SECRET
  if (!isAuthorized) {
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

    // 2026-06-26 変更: 自動配分は一旦停止。スタッフはPINログイン中に手入力で申告。
    const attributed = 0
    const onDutyCount = 0
    const deltaCapped = false

    // 管理者に日次レポート（LINE無料枠に戻すため送信先は経営者2名に限定）
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID).eq('role', 'manager')
      .in('name', ['中地', '谷手'])
      .not('line_user_id', 'is', null)

    const attributionMsg = `\n📌 自動配分は停止中です。スタッフ申告分はスタッフホームから手入力してください。`

    // notify=1（1日1回・夜の回）かつ 件数が増えた時だけ送る（無料枠節約。+0件の通知は出さない）
    if (notify && delta > 0) {
      for (const m of managers ?? []) {
        try {
          await sendStaffLineMessage(m.line_user_id,
            `📊 Google口コミ日次レポート\n\n総件数: ${currentCount}件（前日比 +${delta}）\n平均評価: ★${place.rating ?? '-'}${attributionMsg}`)
        } catch {}
      }
    }

    return NextResponse.json({
      ok: true,
      is_first_run: isFirstRun,
      current_count: currentCount,
      previous_count: previousCount,
      delta,
      delta_capped: deltaCapped,
      on_duty_count: onDutyCount,
      auto_attributed: attributed,
      new_cached_reviews: newCached,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
