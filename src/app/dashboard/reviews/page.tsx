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

  // スタッフ別集計（誘導数・完了数）
  const leadCount = new Map<string, number>()
  const completedCount = new Map<string, number>()
  let unnamedLead = 0
  let unnamedCompleted = 0
  let totalCompleted = 0

  for (const r of reviews) {
    if (r.staff_id) {
      leadCount.set(r.staff_id, (leadCount.get(r.staff_id) ?? 0) + 1)
      if (r.completed) {
        completedCount.set(r.staff_id, (completedCount.get(r.staff_id) ?? 0) + 1)
      }
    } else {
      unnamedLead++
      if (r.completed) unnamedCompleted++
    }
    if (r.completed) totalCompleted++
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranking = staffList.map((s: any) => ({
    staff: s,
    leads: leadCount.get(s.id) ?? 0,
    completed: completedCount.get(s.id) ?? 0,
  })).sort((a: { completed: number; leads: number }, b: { completed: number; leads: number }) => {
    if (b.completed !== a.completed) return b.completed - a.completed
    return b.leads - a.leads
  })

  return {
    reviews, ranking,
    unnamedLead, unnamedCompleted,
    totalLeads: reviews.length,
    totalCompleted,
  }
}

export default async function ReviewsDashboardPage() {
  const { reviews, ranking, totalLeads, totalCompleted } = await getReviewData()
  const month = new Date().getMonth() + 1
  const conversionRate = totalLeads > 0 ? Math.round((totalCompleted / totalLeads) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">口コミ・接客評価</h1>
        <p className="text-sm text-gray-500">{month}月のスタッフ貢献度ランキング</p>
      </div>

      {/* サマリー */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">誘導数</p>
          <p className="text-2xl font-bold text-orange-400">{totalLeads}</p>
          <p className="text-[10px] text-gray-400">クリック</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">完了数</p>
          <p className="text-2xl font-bold text-green-600">{totalCompleted}</p>
          <p className="text-[10px] text-gray-400">書きました</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">完了率</p>
          <p className="text-2xl font-bold text-blue-600">{conversionRate}%</p>
          <p className="text-[10px] text-gray-400">完了/誘導</p>
        </div>
      </div>

      {/* 説明 */}
      <div className="mx-4 mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
        💡 ランキングは「<b>完了数</b>」で集計。お客様がLINEで「書きました」と送信した時点でカウント。
      </div>

      {/* ランキング */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">スタッフ別ランキング（完了数順）</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {ranking.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">データがありません</p>
          ) : ranking.map((r: { staff: { id: string; name: string }; leads: number; completed: number }, i: number) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`
            const maxCompleted = Math.max(...ranking.map((x: { completed: number }) => x.completed), 1)
            const barWidth = (r.completed / maxCompleted) * 100
            const cvr = r.leads > 0 ? Math.round((r.completed / r.leads) * 100) : 0
            return (
              <div key={r.staff.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-10 ${i < 3 ? 'text-2xl' : 'text-gray-400'}`}>{medal}</span>
                    <span className="font-semibold text-gray-800">{r.staff.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-600">{r.completed}</span>
                    <span className="text-xs text-gray-400 ml-1">/ {r.leads}誘導</span>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-green-400 h-full rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">完了率 {cvr}%</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 直近のクリック履歴 */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">直近の口コミ履歴</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {reviews.length === 0 ? (
            <p className="p-4 text-center text-gray-400 text-sm">まだ履歴がありません</p>
          ) : reviews.slice(0, 15).map((r: { staff_id: string | null; staff: { name: string } | null; clicked_at: string; completed: boolean }, i: number) => {
            const d = new Date(r.clicked_at)
            const time = d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={i} className="p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">
                    {r.completed ? '✅' : '📝'} {r.staff?.name ?? '指名なし'}
                  </p>
                  <p className="text-xs text-gray-400">{time}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.completed ? '書き終わり' : '誘導のみ'}
                </span>
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
