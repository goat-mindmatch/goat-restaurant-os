export const dynamic = 'force-dynamic'

/**
 * RPG報酬設定ページ
 * /dashboard/rpg/settings
 * 管理者が各レベルの報酬内容を自由に編集できる
 */

import { DEFAULT_REWARDS } from '@/app/api/rpg/rewards/route'
import type { RPGReward } from '@/app/api/rpg/rewards/route'
import { createServiceClient } from '@/lib/supabase'
import RPGSettingsClient from './SettingsClient'

const TENANT_ID = process.env.TENANT_ID ?? ''

async function getCurrentRewards(): Promise<RPGReward[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any
    const { data } = await db
      .from('tenants')
      .select('rpg_rewards')
      .eq('id', TENANT_ID)
      .single()

    if (data?.rpg_rewards && Array.isArray(data.rpg_rewards)) {
      return data.rpg_rewards as RPGReward[]
    }
  } catch { /* fallback to defaults */ }
  return DEFAULT_REWARDS
}

export default async function RPGSettingsPage() {
  const rewards = await getCurrentRewards()
  return <RPGSettingsClient initialRewards={rewards} />
}
