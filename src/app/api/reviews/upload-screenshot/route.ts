export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/upload-screenshot
 * スクショをアップロード → Claude Vision で自動判定 → 結果返却
 *
 * body: { review_id, image_base64 (data:image/...;base64,... or raw base64) }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const STORE_NAME = '人類みなまぜそば'

type Verdict = {
  is_google_review: boolean
  store_name_visible: boolean
  has_star_rating: boolean
  appears_posted: boolean
  date_looks_recent: boolean
  confidence: number
  verdict: 'approve' | 'review' | 'reject'
  reason: string
}

function generateCouponCode(): string {
  const d = new Date()
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MZ${md}-${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const { review_id, image_base64 } = await req.json()

    if (!review_id || !image_base64) {
      return NextResponse.json({ error: 'review_id and image_base64 required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // レビューレコードの存在確認
    const { data: review } = await db.from('reviews')
      .select('id, verified_at, coupon_code')
      .eq('id', review_id)
      .eq('tenant_id', TENANT_ID)
      .single()

    if (!review) {
      return NextResponse.json({ error: 'review not found' }, { status: 404 })
    }

    if (review.verified_at) {
      return NextResponse.json({
        ok: true,
        already_verified: true,
        coupon_code: review.coupon_code,
        verdict: 'approve',
      })
    }

    // Base64 データの解析
    let rawBase64 = image_base64 as string
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'

    if (rawBase64.startsWith('data:')) {
      const match = rawBase64.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        mediaType = match[1] as typeof mediaType
        rawBase64 = match[2]
      }
    }

    // 画像ハッシュ（重複チェック用）
    const imageHash = crypto.createHash('sha256').update(rawBase64.slice(0, 10000)).digest('hex')

    // 過去30日以内に同じ画像が提出されていないか
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: dupes } = await db.from('reviews')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('screenshot_hash', imageHash)
      .neq('id', review_id)
      .gte('clicked_at', since30d)
      .limit(1)

    if (dupes && dupes.length > 0) {
      return NextResponse.json({
        ok: false,
        verdict: 'reject',
        reason: '同一画像が過去に提出されています。ご自身の投稿画面のスクリーンショットを撮影してください。',
      })
    }

    // Claude Vision API で画像解析
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
    const visionRes = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: rawBase64,
            },
          },
          {
            type: 'text',
            text: `この画像がGoogle Mapsの口コミ投稿画面のスクリーンショットかどうかを判定してください。

確認項目:
1. is_google_review: Google Maps/Google検索 の口コミ画面か（UIデザインから判定）
2. store_name_visible: 店舗名「${STORE_NAME}」（または類似する文字列）が表示されているか
3. has_star_rating: 星（★）評価が表示されているか
4. appears_posted: 投稿済み/完了の状態に見えるか（「投稿しました」「公開」「あなたのクチコミ」等）
5. date_looks_recent: 画面上に表示される日時が直近（今日〜昨日）に見えるか（不明ならtrue）

全てtrue → verdict: "approve"
1つでもfalse → verdict: "review"（要手動確認）
明らかにGoogle口コミ画面でない → verdict: "reject"

以下のJSONのみを返してください（他のテキスト不要）:
{"is_google_review":bool,"store_name_visible":bool,"has_star_rating":bool,"appears_posted":bool,"date_looks_recent":bool,"confidence":0.0-1.0,"verdict":"approve"|"review"|"reject","reason":"日本語で簡潔に"}`,
          },
        ],
      }],
    })

    // AI応答をパース
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiText = (visionRes.content[0] as any).text as string
    let verdict: Verdict

    try {
      // JSON部分を抽出
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      verdict = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText)
    } catch {
      verdict = {
        is_google_review: false,
        store_name_visible: false,
        has_star_rating: false,
        appears_posted: false,
        date_looks_recent: false,
        confidence: 0,
        verdict: 'review',
        reason: 'AI応答のパースに失敗。手動確認が必要です。',
      }
    }

    // 結果に応じてDB更新
    const couponCode = review.coupon_code || generateCouponCode()

    if (verdict.verdict === 'approve') {
      // 自動承認
      await db.from('reviews').update({
        verified_at: new Date().toISOString(),
        coupon_code: couponCode,
        screenshot_hash: imageHash,
        screenshot_verdict: JSON.stringify(verdict),
        note: `coupon:${couponCode} | ai-verified`,
      }).eq('id', review_id)
    } else {
      // 要手動確認 or 却下
      await db.from('reviews').update({
        coupon_code: couponCode,
        screenshot_hash: imageHash,
        screenshot_verdict: JSON.stringify(verdict),
        note: `coupon:${couponCode} | ai-${verdict.verdict}: ${verdict.reason}`,
      }).eq('id', review_id)
    }

    return NextResponse.json({
      ok: true,
      verdict: verdict.verdict,
      reason: verdict.reason,
      confidence: verdict.confidence,
      coupon_code: verdict.verdict === 'approve' ? couponCode : null,
      details: verdict,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
