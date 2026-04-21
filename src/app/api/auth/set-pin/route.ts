export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/set-pin
 * スタッフのPINを設定・変更（経営者のみ）
 *
 * body: { staffId: string, pin: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'manager') {
    return NextResponse.json({ error: '経営者のみ操作できます' }, { status: 403 })
  }

  try {
    const { staffId, pin } = await req.json()
    if (!staffId || !pin || pin.length < 4) {
      return NextResponse.json({ error: 'staffIdとPIN（4桁以上）が必要です' }, { status: 400 })
    }

    const pinHash = await bcrypt.hash(pin, 10)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { error } = await db
      .from('staff')
      .update({ pin_hash: pinHash })
      .eq('id', staffId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
