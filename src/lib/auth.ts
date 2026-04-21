/**
 * 認証ライブラリ（Edge対応）
 * - JWTセッション（jose / Edge・Node.js両対応）
 * - cookies()はNode.jsランタイムのAPI Routeのみで使用
 */

import { SignJWT, jwtVerify } from 'jose'
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

/** JWTトークンを発行 */
export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SESSION_SECRET)
  return token
}

/** JWTトークンを検証してPayloadを返す */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/**
 * CookieからセッションPayloadを取得
 * ※ Node.jsランタイム（API Route / Server Component）専用
 * ※ middleware(proxy.ts)では getSessionFromRequest() を使うこと
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    // 動的インポートでEdgeバンドルに含めない
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    return await verifyToken(token)
  } catch {
    return null
  }
}

/** Requestオブジェクトからセッションを取得（proxy.ts / Edge対応） */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return await verifyToken(token)
}

export { SESSION_COOKIE, SESSION_DURATION }
