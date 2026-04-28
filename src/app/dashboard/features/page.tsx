export const dynamic = 'force-dynamic'

/**
 * /dashboard/features
 * 経営者向け 機能マップ（全機能を説明付きカードで一覧）
 */

import { createServiceClient } from '@/lib/supabase'
import FeaturesClient from './FeaturesClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function FeaturesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 未対応の改善申告数（バッジ用）
  const { data: pending } = await db
    .from('store_improvements')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'pending')

  return <FeaturesClient pendingImprovements={pending?.length ?? 0} />
}
