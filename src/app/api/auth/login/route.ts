export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login
 * PIN認証 → JWTセッションCookieを発行
 *
 * body: { pin: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { createSession, SESSION_COOKIE, SESSION_DURATION } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()
    if (!pin || typeof pin !== 'string' || pin.length < 4) {
      return NextResponse.json({ error: 'PINを入力してください' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // アクティブなスタッフ全員のPINハッシュを取得して照合
    const { data: staffList, error } = await db
      .from('staff')
      .select('id, name, role, pin_hash')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .not('pin_hash', 'is', null)

    if (error) {
      console.error('staff fetch error:', error)
      return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
    }

    // PIN照合（全スタッフを順にチェック）
    let matched = null
    for (const staff of staffList ?? []) {
      if (staff.pin_hash && await bcrypt.compare(pin, staff.pin_hash)) {
        matched = staff
        break
      }
    }

    if (!matched) {
      return NextResponse.json({ error: 'PINが正しくありません' }, { status: 401 })
    }

    // セッショントークン発行
    const token = await createSession({
      staffId: matched.id,
      name:    matched.name,
      role:    matched.role,
    })

    const res = NextResponse.json({
      ok:   true,
      name: matched.name,
      role: matched.role,
    })

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   SESSION_DURATION,
      path:     '/',
    })

    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
