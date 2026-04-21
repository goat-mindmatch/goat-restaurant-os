export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/toggle-active
 * スタッフのアクティブ状態を切り替え（退職者の無効化）
 *
 * body: { staffId: string, isActive: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'manager') {
    return NextResponse.json({ error: '経営者のみ操作できます' }, { status: 403 })
  }

  try {
    const { staffId, isActive } = await req.json()
    if (!staffId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'staffIdとisActiveが必要です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('staff')
      .update({ is_active: isActive })
      .eq('id', staffId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
