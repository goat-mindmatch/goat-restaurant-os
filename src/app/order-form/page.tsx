export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import OrderFormClient from './OrderFormClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function OrderFormPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>
}) {
  const { uid } = await searchParams

  if (!uid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-4xl mb-4">🔗</p>
          <p className="text-gray-700 font-medium">LINE から開いてください</p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const [staffRes, supRes] = await Promise.all([
    db.from('staff').select('id, name')
      .eq('tenant_id', TENANT_ID).eq('line_user_id', uid).single(),
    db.from('suppliers').select('id, name')
      .eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
  ])

  const staff = staffRes.data
  const suppliers = supRes.data ?? []

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-700 font-medium">スタッフ登録が見つかりません</p>
        </div>
      </div>
    )
  }

  return <OrderFormClient staff={staff} suppliers={suppliers} lineUserId={uid} />
}
