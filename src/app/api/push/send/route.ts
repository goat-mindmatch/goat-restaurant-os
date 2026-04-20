export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, body: msgBody, url, type } = body

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 通知キューに追記（stub実装 — web-pushライブラリ未インストール）
    const { error } = await db.from('notification_queue').insert({
      tenant_id: TENANT_ID,
      title: title ?? 'GOAT OS',
      body: msgBody ?? '',
      url: url ?? '/dashboard',
      type: type ?? 'general',
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('notification_queue INSERT error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: '通知キューに追加しました' })
  } catch (err) {
    console.error('push/send error:', err)
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }
}
