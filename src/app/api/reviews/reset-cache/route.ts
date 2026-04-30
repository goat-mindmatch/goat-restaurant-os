export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/reset-cache
 * google_reviews_cache を全削除し、Google Places APIから日本語で再取得する
 * 英語口コミが残ってしまった場合のリセット用
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID  = process.env.TENANT_ID!
const PLACE_ID   = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID
const API_KEY    = process.env.GOOGLE_PLACES_API_KEY
const BASE_URL   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goat-restaurant-os.vercel.app'
const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST() {
  try {
    if (!PLACE_ID || !API_KEY) {
      return NextResponse.json({ ok: false, error: 'Google Places APIキーまたはPlace IDが未設定です' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 1. 既存の口コミキャッシュを全削除
    const { error: deleteError } = await db
      .from('google_reviews_cache')
      .delete()
      .eq('tenant_id', TENANT_ID)

    if (deleteError) {
      return NextResponse.json({ ok: false, error: `キャッシュ削除失敗: ${deleteError.message}` }, { status: 500 })
    }

    // 2. 日本語で再取得（sync-google-reviews を呼ぶ）
    const syncRes = await fetch(
      `${BASE_URL}/api/cron/sync-google-reviews`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      }
    )
    const syncData = await syncRes.json()

    return NextResponse.json({
      ok: true,
      message: `キャッシュを削除し、${syncData.new_cached_reviews ?? 0}件の口コミを日本語で再取得しました`,
      sync: syncData,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
