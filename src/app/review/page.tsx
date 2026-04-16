export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import ReviewClient from './ReviewClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>
}) {
  const { uid } = await searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: staffList } = await db.from('staff')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('name')

  return <ReviewClient staffList={staffList ?? []} customerLineUserId={uid ?? null} />
}
