export const dynamic = 'force-dynamic'

/**
 * /dashboard/improvements
 * 店舗改善申告 管理画面（承認 / 却下 / EXP付与）
 */

import { createServiceClient } from '@/lib/supabase'
import ImprovementsClient from './ImprovementsClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function ImprovementsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: improvements } = await db
    .from('store_improvements')
    .select(`
      id, staff_id, staff_name, category, content,
      status, exp_reward, reviewer_note, created_at, reviewed_at,
      staff:staff_id ( name )
    `)
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })

  return <ImprovementsClient improvements={improvements ?? []} />
}
