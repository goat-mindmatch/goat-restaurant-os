export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sync-trigger
 * 「AnyDeli 今すぐ同期」ボタンから呼ばれる
 *
 * 処理:
 * 1. tenants.sync_requested_at を更新（ステータス追跡用）
 * 2. GitHub repository_dispatch API を呼び出し → Actions ワークフローを即時起動
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID      = process.env.TENANT_ID!
const GITHUB_PAT     = process.env.GITHUB_PAT        // Fine-grained PAT (actions: write)
const GITHUB_OWNER   = process.env.GITHUB_OWNER ?? 'goat-mindmatch'
const GITHUB_REPO    = process.env.GITHUB_REPO  ?? 'goat-restaurant-os'

export async function POST() {
  try {
    const now = new Date().toISOString()

    // 1. Supabase に同期リクエストを記録
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error: dbError } = await db
      .from('tenants')
      .update({ sync_requested_at: now })
      .eq('id', TENANT_ID)

    if (dbError) throw dbError

    // 2. GitHub Actions を起動（repository_dispatch）
    if (!GITHUB_PAT) {
      // PAT が未設定の場合は Supabase フラグ方式にフォールバック（ローカル Mac 用）
      return NextResponse.json({
        ok:           true,
        mode:         'supabase_flag',
        requested_at: now,
        message:      '同期リクエストを記録しました（60秒以内にMacが実行）',
        warning:      'GITHUB_PAT が未設定のため GitHub Actions は起動しませんでした',
      })
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_PAT}`,
          'Accept':        'application/vnd.github+json',
          'Content-Type':  'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          event_type:    'anydeli-sync',
          client_payload: { triggered_at: now },
        }),
      }
    )

    if (!ghRes.ok) {
      const ghBody = await ghRes.text()
      throw new Error(`GitHub API エラー ${ghRes.status}: ${ghBody}`)
    }

    return NextResponse.json({
      ok:           true,
      mode:         'github_actions',
      requested_at: now,
      message:      'GitHub Actions を起動しました。約60〜90秒で同期が完了します。',
    })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
