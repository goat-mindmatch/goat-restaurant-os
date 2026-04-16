/**
 * シフト希望フォーム（スタッフ用ブラウザフォーム）
 * URL: /shift-form?uid=LINE_USER_ID
 */
import { createServiceClient } from '@/lib/supabase'
import ShiftFormClient from './ShiftFormClient'

export const dynamic = 'force-dynamic'

const TENANT_ID = process.env.TENANT_ID!

async function getStaffAndData(lineUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: staff } = await db
    .from('staff').select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('line_user_id', lineUserId)
    .single()

  if (!staff) return { staff: null, existing: null, boardData: [] }

  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = nextMonth.getMonth() + 1

  // 既存の提出データ
  const { data: existing } = await db
    .from('shift_requests')
    .select('available_dates, preferred_dates')
    .eq('staff_id', staff.id)
    .eq('target_year', year)
    .eq('target_month', month)
    .single()

  // 他スタッフの提出状況（透明化ボード用）
  const { data: boardRequests } = await db
    .from('shift_requests')
    .select('staff_id, available_dates, staff(name)')
    .eq('tenant_id', TENANT_ID)
    .eq('target_year', year)
    .eq('target_month', month)

  return {
    staff: staff as { id: string; name: string },
    existing: existing as { available_dates: string[]; preferred_dates: string[] } | null,
    year,
    month,
    boardRequests: boardRequests ?? [],
  }
}

type SearchParams = { uid?: string }

export default async function ShiftFormPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const lineUserId = params.uid ?? ''

  if (!lineUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-4xl mb-4">🔗</p>
          <p className="text-gray-700 font-medium">LINE から開いてください</p>
          <p className="text-sm text-gray-400 mt-2">このページはLINEのシフト希望ボタンから開きます</p>
        </div>
      </div>
    )
  }

  const result = await getStaffAndData(lineUserId)

  if (!result.staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-700 font-medium">スタッフ登録が見つかりません</p>
          <p className="text-sm text-gray-400 mt-2">先にLINEでスタッフ登録を完了してください</p>
        </div>
      </div>
    )
  }

  return (
    <ShiftFormClient
      staff={result.staff}
      year={result.year!}
      month={result.month!}
      existing={result.existing}
      boardRequests={result.boardRequests}
      lineUserId={lineUserId}
    />
  )
}
