export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/rpg/rewards  — 報酬ロードマップ取得（DBになければデフォルト値を返す）
 * POST /api/rpg/rewards  — 報酬ロードマップ保存
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export type RPGReward = {
  level: number
  icon: string
  title: string
  desc: string
  color: string
}

export const DEFAULT_REWARDS: RPGReward[] = [
  { level: 5,  icon: '🎯', title: '好きなシフト優先権',      desc: '1日分のシフト希望が100%通る',      color: '#34D399' },
  { level: 10, icon: '🍜', title: '店長とのランチ',          desc: 'メニューは何でもOK、好きな話をしよう', color: '#60A5FA' },
  { level: 15, icon: '🎌', title: '特別休暇1日',            desc: '希望日に特別休暇取得権',             color: '#F59E0B' },
  { level: 20, icon: '💰', title: '時給 +¥50（1ヶ月）',     desc: '翌月の給与に反映',                  color: '#A855F7' },
  { level: 25, icon: '👑', title: '伝説ボーナス ¥10,000',    desc: '神クラス到達の証',                  color: '#FFD700' },
]

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data, error } = await db
      .from('tenants')
      .select('rpg_rewards')
      .eq('id', TENANT_ID)
      .single()

    // カラムが存在しない or null の場合はデフォルト値を返す
    if (error || !data?.rpg_rewards) {
      return NextResponse.json({ rewards: DEFAULT_REWARDS, source: 'default' })
    }

    return NextResponse.json({ rewards: data.rpg_rewards as RPGReward[], source: 'db' })
  } catch {
    return NextResponse.json({ rewards: DEFAULT_REWARDS, source: 'default' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rewards } = await req.json() as { rewards: RPGReward[] }

    if (!Array.isArray(rewards) || rewards.length === 0) {
      return NextResponse.json({ error: 'rewards は配列で指定してください' }, { status: 400 })
    }

    // バリデーション
    for (const r of rewards) {
      if (!r.level || !r.title) {
        return NextResponse.json({ error: 'level と title は必須です' }, { status: 400 })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('tenants')
      .update({ rpg_rewards: rewards })
      .eq('id', TENANT_ID)

    if (error) {
      // カラムが存在しない場合のエラーをわかりやすく
      if (error.message?.includes('rpg_rewards')) {
        return NextResponse.json({
          error: 'DBカラムが未作成です。Supabase で以下のSQLを実行してください:\nALTER TABLE tenants ADD COLUMN IF NOT EXISTS rpg_rewards JSONB;',
          code: 'COLUMN_MISSING',
        }, { status: 500 })
      }
      throw error
    }

    return NextResponse.json({ ok: true, message: '報酬ロードマップを保存しました' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
