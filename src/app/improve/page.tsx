export const dynamic = 'force-dynamic'

/**
 * /improve
 * スタッフ向け 店舗改善申告フォーム（公開・ログイン不要）
 * LINEリッチメニューのボタンからアクセス
 */

import { createServiceClient } from '@/lib/supabase'
import ImprovementForm from './ImprovementForm'

const TENANT_ID = process.env.TENANT_ID!

export default async function ImprovePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: staffList } = await db
    .from('staff')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('name')

  return <ImprovementForm staffList={staffList ?? []} />
}
