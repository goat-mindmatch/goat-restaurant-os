export const dynamic = 'force-dynamic'

/**
 * GET  /api/improvements          管理者: 一覧取得（status絞り込み可）
 * POST /api/improvements          スタッフ/匿名: 申告投稿
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const query = db
    .from('store_improvements')
    .select(`
      id, staff_id, staff_name, category, content, status,
      exp_reward, reviewer_note, created_at, reviewed_at,
      staff:staff_id ( name )
    `)
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })

  if (status !== 'all') query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { staff_id, staff_name, category, content } = body as {
    staff_id?: string
    staff_name?: string
    category: string
    content: string
  }

  if (!content?.trim()) {
    return NextResponse.json({ error: '内容を入力してください' }, { status: 400 })
  }

  const validCategories = ['service', 'operation', 'cleanliness', 'menu', 'other']
  const cat = validCategories.includes(category) ? category : 'other'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data, error } = await db
    .from('store_improvements')
    .insert({
      tenant_id:  TENANT_ID,
      staff_id:   staff_id || null,
      staff_name: staff_name?.trim() || null,
      category:   cat,
      content:    content.trim(),
      status:     'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
