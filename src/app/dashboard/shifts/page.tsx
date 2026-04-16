export const dynamic = 'force-dynamic'

/**
 * シフト管理ページ
 * - 全スタッフ × 全日付のマトリクス表示
 * - 提出状況・未提出者一覧
 * - 将来: AI競合検出・確定ボタン
 */

import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

type StaffRow = { id: string; name: string }
type ShiftRequestRow = {
  staff_id: string
  available_dates: string[]
  staff: { name: string }
}

async function getShiftData(year: number, month: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const [staffRes, requestsRes] = await Promise.all([
    db.from('staff').select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name'),
    db.from('shift_requests')
      .select('staff_id, available_dates, staff(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('target_year', year)
      .eq('target_month', month),
  ])

  const staffList: StaffRow[] = staffRes.data ?? []
  const requests: ShiftRequestRow[] = requestsRes.data ?? []
  const lastDay = new Date(year, month, 0).getDate()

  // staff_id → available_dates のマップ
  const requestMap: Record<string, Set<number>> = {}
  for (const req of requests) {
    const days = new Set(
      (req.available_dates as string[]).map(d => parseInt(d.split('-')[2]))
    )
    requestMap[req.staff_id] = days
  }

  // 未提出者
  const submittedIds = new Set(requests.map(r => r.staff_id))
  const notSubmitted = staffList.filter(s => !submittedIds.has(s.id))

  return { staffList, requestMap, lastDay, notSubmitted, requests }
}

const DAYS_JP = ['日','月','火','水','木','金','土']

export default async function ShiftsPage() {
  const now = new Date()
  // 来月のデータを表示
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const year = nextMonth.getFullYear()
  const month = nextMonth.getMonth() + 1

  const { staffList, requestMap, lastDay, notSubmitted } = await getShiftData(year, month)

  const days = Array.from({ length: lastDay }, (_, i) => i + 1)

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">シフト管理</h1>
        <p className="text-sm text-gray-500">{year}年{month}月 希望提出状況</p>
      </div>

      {/* 未提出者アラート */}
      {notSubmitted.length > 0 && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700 mb-1">
            ⚠️ 未提出 {notSubmitted.length}名
          </p>
          <p className="text-sm text-amber-600">
            {notSubmitted.map(s => s.name).join('・')}
          </p>
        </div>
      )}

      {/* 提出済み人数 */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">提出済み</p>
          <p className="text-2xl font-bold text-green-600">
            {staffList.length - notSubmitted.length}
            <span className="text-sm font-normal text-gray-400">/{staffList.length}名</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">対象月</p>
          <p className="text-2xl font-bold text-gray-800">{month}月</p>
        </div>
      </div>

      {/* シフトマトリクス */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">希望カレンダー</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left text-gray-500 sticky left-0 bg-white min-w-16">スタッフ</th>
                {days.map(d => {
                  const dow = new Date(year, month - 1, d).getDay()
                  const isSun = dow === 0
                  const isSat = dow === 6
                  return (
                    <th key={d} className={`p-1 text-center min-w-8 ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-500'}`}>
                      <div>{d}</div>
                      <div className="text-gray-300">{DAYS_JP[dow]}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.map(staff => {
                const availDays = requestMap[staff.id]
                return (
                  <tr key={staff.id} className="border-b last:border-0">
                    <td className="p-2 font-medium text-gray-700 sticky left-0 bg-white">{staff.name}</td>
                    {days.map(d => {
                      const isAvail = availDays?.has(d)
                      const dow = new Date(year, month - 1, d).getDay()
                      const isWeekend = dow === 0 || dow === 6
                      return (
                        <td key={d} className={`text-center p-1 ${isWeekend ? 'bg-gray-50' : ''}`}>
                          {isAvail
                            ? <span className="text-green-500 font-bold">○</span>
                            : availDays
                              ? <span className="text-gray-200">–</span>
                              : <span className="text-amber-300">?</span>
                          }
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          ○=希望あり　–=希望なし　?=未提出
        </p>
      </div>

      {/* 日別人数サマリ */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">日別 希望人数</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b">
                {days.map(d => {
                  const dow = new Date(year, month - 1, d).getDay()
                  const isSun = dow === 0
                  const isSat = dow === 6
                  return (
                    <th key={d} className={`p-2 text-center min-w-10 ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-500'}`}>
                      {month}/{d}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map(d => {
                  const count = staffList.filter(s => requestMap[s.id]?.has(d)).length
                  const color = count >= 3 ? 'text-green-600' : count >= 2 ? 'text-yellow-600' : count >= 1 ? 'text-orange-500' : 'text-gray-300'
                  return (
                    <td key={d} className={`text-center p-2 font-bold ${color}`}>
                      {count > 0 ? count : '–'}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1">緑=3名以上　黄=2名　橙=1名</p>
      </div>

      {/* ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          {[
            { label: 'ホーム', href: '/dashboard', icon: '🏠' },
            { label: 'シフト', href: '/dashboard/shifts', icon: '📅' },
            { label: '発注', href: '/dashboard/orders', icon: '📦' },
            { label: '設定', href: '/dashboard/settings', icon: '⚙️' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="flex flex-col items-center py-1 text-xs text-gray-500 hover:text-gray-900">
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  )
}
