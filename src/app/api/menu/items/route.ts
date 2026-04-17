export const dynamic = 'force-dynamic'

/**
 * GET /api/menu/items
 * お客様向けメニュー一覧取得（anon可）
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: items } = await db.from('menu_items')
    .select('id, name, description, price, category, image_url, sort_order')
    .eq('tenant_id', TENANT_ID)
    .eq('is_available', true)
    .order('sort_order')

  return NextResponse.json({ items: items ?? [] })
}
