export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json() as {
      rows: { date: string; staff_id: string }[]
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'rows が空です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const insertData = rows.map(r => ({
      tenant_id: TENANT_ID,
      staff_id: r.staff_id,
      date: r.date,
      start_time: '10:00',
      end_time: '20:00',
      status: 'confirmed',
    }))

    const { error } = await db
      .from('shifts')
      .upsert(insertData, { onConflict: 'tenant_id,staff_id,date' })

    if (error) {
      console.error('bulk-insert shifts error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err) {
    console.error('bulk-insert error:', err)
    return NextResponse.json({ error: '確定に失敗しました' }, { status: 500 })
  }
}
