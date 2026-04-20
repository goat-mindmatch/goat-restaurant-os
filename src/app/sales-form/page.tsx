export const dynamic = 'force-dynamic'

/**
 * 売上入力フォーム（経営者用ブラウザフォーム）
 * URL: /sales-form?uid=LINE_USER_ID
 */

import { createServiceClient } from '@/lib/supabase'
import SalesFormClient from './SalesFormClient'

const TENANT_ID = process.env.TENANT_ID!

async function getManagerAndToday(lineUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: staff } = await db.from('staff')
    .select('id, name, role')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  if (!staff || staff.role !== 'manager') return { staff: null, today: null, existing: null }

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    .toISOString().split('T')[0]

  const { data: existing } = await db.from('daily_sales')
    .select('store_sales, uber_sales, rocketnow_sales, menu_sales, delivery_sales, total_sales, lunch_sales, dinner_sales, food_cost')
    .eq('tenant_id', TENANT_ID)
    .eq('date', today)
    .single()

  return { staff, today, existing }
}

export default async function SalesFormPage({
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
          <p className="text-sm text-gray-400 mt-2">経営者メニューの「売上入力」から開きます</p>
        </div>
      </div>
    )
  }

  const { staff, today, existing } = await getManagerAndToday(uid)

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-700 font-medium">経営者アカウントが見つかりません</p>
          <p className="text-sm text-gray-400 mt-2">管理者に連絡してください</p>
        </div>
      </div>
    )
  }

  return (
    <SalesFormClient
      lineUserId={uid}
      staffName={staff.name}
      today={today!}
      existing={existing}
    />
  )
}
