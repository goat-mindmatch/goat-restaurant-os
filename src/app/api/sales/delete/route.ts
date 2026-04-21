export const dynamic = 'force-dynamic'

/**
 * DELETE /api/sales/delete?date=YYYY-MM-DD
 * 指定日の売上データをリセット（ゼロクリア）する
 * ※ 物理削除ではなく全カラムを 0 に戻す（dailySales の unique 制約保持のため）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date パラメータが必要です（YYYY-MM-DD）' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 物理削除（該当行を完全に消す）
    const { error } = await db
      .from('daily_sales')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)

    if (error) throw error

    return NextResponse.json({ ok: true, deleted: date })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
