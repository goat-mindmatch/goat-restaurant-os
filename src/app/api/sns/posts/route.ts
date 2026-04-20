/**
 * GET  /api/sns/posts   — 投稿一覧
 * POST /api/sns/posts   — 投稿予約（status='scheduled'で保存）
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data, error } = await db
    .from('sns_posts')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const body = await req.json()

    const insert = {
      tenant_id: TENANT_ID,
      menu_name: body.menu_name ?? null,
      photo_url: body.photo_url ?? null,
      caption: body.caption ?? '',
      hashtags: body.hashtags ?? [],
      platforms: body.platforms ?? [],
      scheduled_at: body.scheduled_at ?? null,
      status: 'scheduled' as const,
    }

    const { data, error } = await db.from('sns_posts').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ post: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '保存に失敗しました' },
      { status: 500 }
    )
  }
}
