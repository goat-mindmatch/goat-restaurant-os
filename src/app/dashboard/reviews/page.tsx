export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

async function getReviewData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const now = new Date()
  const firstDay = now.toISOString().slice(0, 7) + '-01'

  const [reviewsRes, staffRes] = await Promise.all([
    db.from('reviews')
      .select('staff_id, clicked_at, completed, staff(name)')
      .eq('tenant_id', TENANT_ID)
      .gte('clicked_at', firstDay)
      .order('clicked_at', { ascending: false }),
    db.from('staff').select('id, name')
      .eq('tenant_id', TENANT_ID).eq('is_active', true),
  ])

  const reviews = reviewsRes.data ?? []
  const staffList = staffRes.data ?? []

  // スタッフ別集計
  const staffCount = new Map<string, number>()
  let unnamed = 0
  for (const r of reviews) {
    if (r.staff_id) {
      staffCount.set(r.staff_id, (staffCount.get(r.staff_id) ?? 0) + 1)
    } else {
      unnamed++
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranking = staffList.map((s: any) => ({
    staff: s,
    count: staffCount.get(s.id) ?? 0,
  })).sort((a: { count: number }, b: { count: number }) => b.count - a.count)

  return { reviews, ranking, unnamed, total: reviews.length }
}

export default async function ReviewsDashboardPage() {
  const { reviews, ranking, unnamed, total } = await getReviewData()
  const month = new Date().getMonth() + 1

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">口コミ・接客評価</h1>
        <p className="text-sm text-gray-500">{month}月のスタッフ貢献度ランキング</p>
      </div>

      {/* サマリー */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">今月のクリック数</p>
          <p className="text-3xl font-bold text-orange-500">{total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">指名なし</p>
          <p className="text-3xl font-bold text-gray-400">{unnamed}</p>
        </div>
      </div>

      {/* ランキング */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">スタッフ別ランキング</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {ranking.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">データがありません</p>
          ) : ranking.map((r: { staff: { id: string; name: string }; count: number }, i: number) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`
            const barWidth = ranking[0].count > 0 ? (r.count / ranking[0].count) * 100 : 0
            return (
              <div key={r.staff.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-10 ${i < 3 ? 'text-2xl' : 'text-gray-400'}`}>{medal}</span>
                    <span className="font-semibold text-gray-800">{r.staff.name}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{r.count}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-orange-400 h-full rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 直近のクリック履歴 */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">直近の口コミクリック</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {reviews.length === 0 ? (
            <p className="p-4 text-center text-gray-400 text-sm">まだクリック履歴がありません</p>
          ) : reviews.slice(0, 10).map((r: { staff_id: string | null; staff: { name: string } | null; clicked_at: string }, i: number) => {
            const d = new Date(r.clicked_at)
            const time = d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
            return (
              <div key={i} className="p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{r.staff?.name ?? '指名なし'}</p>
                  <p className="text-xs text-gray-400">{time}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {[
            { label: 'ホーム', href: '/dashboard', icon: '🏠' },
            { label: 'シフト', href: '/dashboard/shifts', icon: '📅' },
            { label: '発注', href: '/dashboard/orders', icon: '📦' },
            { label: '売上', href: '/dashboard/sales', icon: '💰' },
            { label: '給与', href: '/dashboard/payroll', icon: '💴' },
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
