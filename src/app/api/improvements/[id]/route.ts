export const dynamic = 'force-dynamic'

/**
 * PATCH /api/improvements/[id]   管理者: 承認 or 却下 + EXP付与
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { action, exp_reward, reviewer_note } = body as {
    action: 'approve' | 'reject'
    exp_reward?: number
    reviewer_note?: string
  }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const status     = action === 'approve' ? 'approved' : 'rejected'
  const expReward  = action === 'approve' ? (exp_reward ?? 100) : 0
  const reviewedAt = new Date().toISOString()

  const { data, error } = await db
    .from('store_improvements')
    .update({
      status,
      exp_reward:    expReward,
      reviewer_note: reviewer_note?.trim() ?? null,
      reviewed_at:   reviewedAt,
    })
    .eq('id', id)
    .eq('tenant_id', TENANT_ID)
    .select('staff_id, staff_name, content, status, exp_reward')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 承認かつスタッフ紐付きの場合: staff_rpg にEXPを加算
  if (action === 'approve' && data?.staff_id && expReward > 0) {
    // staff_rpg に既存レコードがあれば加算、なければ upsert
    const { data: existing } = await db
      .from('staff_rpg')
      .select('exp')
      .eq('staff_id', data.staff_id)
      .eq('tenant_id', TENANT_ID)
      .single()

    const newExp = (existing?.exp ?? 0) + expReward
    await db.from('staff_rpg').upsert({
      tenant_id: TENANT_ID,
      staff_id:  data.staff_id,
      exp:       newExp,
      level:     Math.floor(newExp / 1000) + 1,
    }, { onConflict: 'tenant_id,staff_id' })
  }

  return NextResponse.json({ ok: true, data })
}
