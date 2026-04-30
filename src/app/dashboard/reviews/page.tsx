export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import DashboardNav from '@/components/DashboardNav'
import ExpandableText from '@/components/ExpandableText'

const TENANT_ID = process.env.TENANT_ID!

async function getReviewData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const now = new Date()
  const firstDay = now.toISOString().slice(0, 7) + '-01'

  const [reviewsRes, staffRes, googleCountRes, googleCacheRes] = await Promise.all([
    db.from('reviews')
      .select('staff_id, clicked_at, completed, verified_at, sentiment, exp_awarded, review_text, staff:staff!reviews_staff_id_fkey(name)')
      .eq('tenant_id', TENANT_ID)
      .gte('clicked_at', firstDay)
      .order('clicked_at', { ascending: false }),
    db.from('staff').select('id, name')
      .eq('tenant_id', TENANT_ID).eq('is_active', true),
    db.from('google_review_count_history')
      .select('count, rating, checked_at')
      .eq('tenant_id', TENANT_ID)
      .order('checked_at', { ascending: false })
      .limit(2),
    db.from('google_reviews_cache')
      .select('reviewer_name, star_rating, comment, created_time')
      .eq('tenant_id', TENANT_ID)
      .order('created_time', { ascending: false })
      .limit(5),
  ])

  const reviews = reviewsRes.data ?? []
  const staffList = staffRes.data ?? []

  // スタッフ別集計
  const leadCount = new Map<string, number>()
  const claimedCount = new Map<string, number>()
  const verifiedCount = new Map<string, number>()
  let totalClaimed = 0
  let totalVerified = 0

  for (const r of reviews) {
    const sid = r.staff_id
    if (sid) {
      leadCount.set(sid, (leadCount.get(sid) ?? 0) + 1)
      if (r.completed) claimedCount.set(sid, (claimedCount.get(sid) ?? 0) + 1)
      if (r.verified_at) verifiedCount.set(sid, (verifiedCount.get(sid) ?? 0) + 1)
    }
    if (r.completed) totalClaimed++
    if (r.verified_at) totalVerified++
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ranking = staffList.map((s: any) => ({
    staff: s,
    leads: leadCount.get(s.id) ?? 0,
    claimed: claimedCount.get(s.id) ?? 0,
    verified: verifiedCount.get(s.id) ?? 0,
  })).sort((a: { verified: number; claimed: number }, b: { verified: number; claimed: number }) => {
    if (b.verified !== a.verified) return b.verified - a.verified
    return b.claimed - a.claimed
  })

  const googleLatest = googleCountRes.data?.[0] ?? null
  const googlePrev   = googleCountRes.data?.[1] ?? null
  const googleDelta  = googleLatest && googlePrev
    ? Math.max(0, (googleLatest.count ?? 0) - (googlePrev.count ?? 0))
    : null

  return {
    reviews, ranking,
    totalLeads: reviews.length,
    totalClaimed,
    totalVerified,
    google: {
      count:  googleLatest?.count  ?? null,
      rating: googleLatest?.rating ?? null,
      delta:  googleDelta,
      cache:  googleCacheRes.data  ?? [],
    },
  }
}

export default async function ReviewsDashboardPage() {
  const { reviews, ranking, totalLeads, totalClaimed, totalVerified, google } = await getReviewData()
  const month = new Date().getMonth() + 1

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">口コミ・接客評価</h1>
        <p className="text-sm text-gray-500">{month}月のスタッフ貢献度ランキング</p>
      </div>

      {/* Google口コミ集計（自動取得） */}
      {google.count !== null && (
        <div className="mx-4 mt-4 bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3">📊 Google口コミ（自動取得）</p>
          <div className="flex gap-4 mb-3">
            <div className="text-center">
              <p className="text-3xl font-black text-gray-900">{google.count}</p>
              <p className="text-xs text-gray-400">総口コミ数</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-yellow-500">★{google.rating ?? '-'}</p>
              <p className="text-xs text-gray-400">平均評価</p>
            </div>
            {google.delta !== null && (
              <div className="text-center">
                <p className="text-3xl font-black text-green-600">+{google.delta}</p>
                <p className="text-xs text-gray-400">前日比</p>
              </div>
            )}
          </div>
          {/* 最新口コミ */}
          {google.cache.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs text-gray-400">直近の口コミ（Google自動取得）</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {google.cache.map((r: any, i: number) => {
                const postedAt = r.created_time
                  ? new Date(r.created_time).toLocaleString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
                return (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{r.reviewer_name ?? '匿名'}</p>
                        {postedAt && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{postedAt}</p>
                        )}
                      </div>
                      <p className="text-xs text-yellow-500 shrink-0 ml-2">{'★'.repeat(Number(r.star_rating) || 0)}</p>
                    </div>
                    {r.comment && (
                      <ExpandableText text={r.comment} className="mt-1" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* サマリー：3段階（誘導 → 申告 → 検証済） */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">誘導数</p>
          <p className="text-2xl font-bold text-gray-400">{totalLeads}</p>
          <p className="text-[10px] text-gray-400">クリック</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">申告数</p>
          <p className="text-2xl font-bold text-amber-500">{totalClaimed}</p>
          <p className="text-[10px] text-gray-400">書きましたタップ</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center border-2 border-green-200">
          <p className="text-[10px] text-green-700 font-semibold">検証済み</p>
          <p className="text-2xl font-bold text-green-600">{totalVerified}</p>
          <p className="text-[10px] text-gray-400">スタッフ承認</p>
        </div>
      </div>

      {/* 説明 */}
      <div className="mx-4 mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
        💡 ランキングは「<b>検証済み数</b>」で集計。次回来店時にスタッフがGoogleレビューを確認・承認した時点でカウント。
      </div>

      {/* ランキング */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">スタッフ別ランキング（検証済み数順）</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {ranking.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">データがありません</p>
          ) : ranking.map((r: { staff: { id: string; name: string }; leads: number; claimed: number; verified: number }, i: number) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`
            const maxVerified = Math.max(...ranking.map((x: { verified: number }) => x.verified), 1)
            const barWidth = (r.verified / maxVerified) * 100
            return (
              <div key={r.staff.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-10 ${i < 3 ? 'text-2xl' : 'text-gray-400'}`}>{medal}</span>
                    <span className="font-semibold text-gray-800">{r.staff.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-600">{r.verified}</span>
                    <span className="text-xs text-gray-400 ml-1">/ {r.claimed}申告 / {r.leads}誘導</span>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-green-400 h-full rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 直近履歴 */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">直近の口コミ履歴</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {reviews.length === 0 ? (
            <p className="p-4 text-center text-gray-400 text-sm">まだ履歴がありません</p>
          ) : reviews.slice(0, 15).map((r: {
              staff_id: string | null
              staff: { name: string } | null
              clicked_at: string
              completed: boolean
              verified_at: string | null
              sentiment: string | null
              exp_awarded: number | null
              review_text: string | null
            }, i: number) => {
            const d = new Date(r.clicked_at)
            const time = d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            const status = r.verified_at ? { icon: '✅', label: '検証済', color: 'bg-green-100 text-green-700' }
              : r.completed ? { icon: '⏳', label: '承認待ち', color: 'bg-amber-100 text-amber-700' }
              : { icon: '📝', label: '誘導のみ', color: 'bg-gray-100 text-gray-600' }

            // sentimentバッジ
            const sentimentBadge =
              r.sentiment === 'positive' ? { label: '⭐ 褒めあり', color: 'bg-yellow-100 text-yellow-700' }
              : r.sentiment === 'negative' ? { label: '⚠️ ネガあり', color: 'bg-red-100 text-red-700' }
              : null

            return (
              <div key={i} className="p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">
                      {status.icon} {r.staff?.name ?? '指名なし'}
                    </p>
                    <p className="text-xs text-gray-400">{time}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                    {sentimentBadge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${sentimentBadge.color}`}>
                        {sentimentBadge.label}
                      </span>
                    )}
                    {r.verified_at && r.exp_awarded && (
                      <span className="text-[10px] text-orange-600 font-bold">+{r.exp_awarded} EXP</span>
                    )}
                  </div>
                </div>
                {/* 口コミ本文（本文ありの場合は折りたたみ表示） */}
                {r.completed && r.review_text && (
                  <div className="mt-1 bg-gray-50 rounded p-2">
                    <ExpandableText text={`"${r.review_text}"`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <DashboardNav current="/dashboard/reviews" />
    </main>
  )
}
