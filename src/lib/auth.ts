/**
 * 認証ライブラリ
 * - JWTセッション（jose / Edge対応）
 * - PINハッシュ検証（bcryptjs / API Route専用）
 */

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'goat_session'
const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'goat-restaurant-os-secret-change-in-production'
)
const SESSION_DURATION = 60 * 60 * 12 // 12時間

export type SessionPayload = {
  staffId:  string
  name:     string
  role:     'manager' | 'staff'
}

/** JWTセッションを発行してCookieにセット */
export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SESSION_SECRET)
  return token
}

/** CookieからセッションPayloadを取得（Server Component / API Route用） */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SESSION_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** Requestオブジェクトからセッションを取得（middleware用） */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SESSION_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export { SESSION_COOKIE, SESSION_DURATION }
