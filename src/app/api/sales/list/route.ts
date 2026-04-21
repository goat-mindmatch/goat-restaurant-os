export const dynamic = 'force-dynamic'

/**
 * GET /api/sales/list?month=YYYY-MM
 * 今月の日別売上一覧を返す（SalesClient の「更新」ボタン用）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // JST で今月を計算
    const nowJST  = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const todayJST = nowJST.toISOString().split('T')[0]

    const qMonth = searchParams.get('month')
    const month  = (qMonth && /^\d{4}-\d{2}$/.test(qMonth)) ? qMonth : todayJST.slice(0, 7)

    const firstDay = month + '-01'
    const lastDay  = todayJST.slice(0, 7) === month ? todayJST : `${month}-31`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { data: sales, error } = await db
      .from('daily_sales')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false })

    if (error) throw error

    return NextResponse.json({ sales: sales ?? [] })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
