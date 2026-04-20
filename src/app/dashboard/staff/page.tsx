export const dynamic = 'force-dynamic'

/**
 * スタッフ管理ページ
 * /dashboard/staff
 */

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import StaffClient from './StaffClient'

const TENANT_ID = process.env.TENANT_ID!

async function getStaff() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data } = await db
    .from('staff')
    .select('id, name, role, hourly_wage, transport_fee, is_active, line_user_id')
    .eq('tenant_id', TENANT_ID)
    .order('is_active', { ascending: false })
    .order('name')
  return data ?? []
}

export default async function StaffPage() {
  const staff = await getStaff()
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <StaffClient initialStaff={staff} />
      <DashboardNav current="/dashboard/staff" />
    </main>
  )
}
