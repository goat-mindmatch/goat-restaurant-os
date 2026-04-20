'use client'

import { useState } from 'react'

type Customer = {
  id: string
  line_user_id: string | null
  display_name: string | null
  points: number
  visit_count: number
  total_spent: number
  birthday: string | null
  last_visit_at: string | null
  created_at: string
}

type Transaction = {
  id: string
  points: number
  type: string
  description: string | null
  created_at: string
  customer: { display_name: string | null } | null
}

type Stats = { totalCustomers: number; totalPoints: number; avgVisits: number }

function getRank(points: number): { label: string; color: string; icon: string } {
  if (points >= 5000) return { label: 'プラチナ', color: 'text-purple-600 bg-purple-50', icon: '💎' }
  if (points >= 2000) return { label: 'ゴールド',  color: 'text-yellow-600 bg-yellow-50', icon: '🥇' }
  if (points >= 500)  return { label: 'シルバー',  color: 'text-gray-500 bg-gray-100',    icon: '🥈' }
  return { label: 'レギュラー', color: 'text-orange-600 bg-orange-50', icon: '🍜' }
}

export default function LoyaltyClient({
  data,
}: {
  data: { customers: Customer[]; transactions: Transaction[]; stats: Stats }
}) {
  const { customers, transactions, stats } = data
  const [tab, setTab] = useState<'customers' | 'history'>('customers')
  const [search, setSearch] = useState('')
  const [sendForm, setSendForm] = useState<{ open: boolean; customerId: string | null }>({ open: false, customerId: null })
  const [sendMsg, setSendMsg] = useState<string | null>(null)

  const filtered = customers.filter(c =>
    !search || (c.display_name ?? '').includes(search)
  )

  const handleSendCoupon = async (customerId: string, lineUserId: string) => {
    const res = await fetch('/api/loyalty/send-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, lineUserId }),
    })
    setSendMsg(res.ok ? '✅ クーポンを送信しました！' : '⚠️ 送信に失敗しました')
    setTimeout(() => setSendMsg(null), 3000)
  }

  return (
    <div className="pb-4">
      {/* サマリーカード */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-black text-orange-600">{stats.totalCustomers}</p>
          <p className="text-xs text-gray-400 mt-1">LINE会員数</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-black text-blue-600">{stats.totalPoints.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">総保有ポイント</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-black text-green-600">{stats.avgVisits}</p>
          <p className="text-xs text-gray-400 mt-1">平均来店回数</p>
        </div>
      </div>

      {/* ランク説明 */}
      <div className="mx-4 mt-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-4 text-white">
        <p className="text-sm font-bold mb-2">ランク制度</p>
        <div className="grid grid-cols-4 gap-1 text-center text-xs">
          {[
            { icon: '🍜', label: 'レギュラー', pts: '〜499pt' },
            { icon: '🥈', label: 'シルバー',  pts: '500pt〜' },
            { icon: '🥇', label: 'ゴールド',  pts: '2000pt〜' },
            { icon: '💎', label: 'プラチナ',  pts: '5000pt〜' },
          ].map(r => (
            <div key={r.label} className="bg-white/20 rounded-lg py-2">
              <div className="text-lg">{r.icon}</div>
              <div className="font-semibold">{r.label}</div>
              <div className="text-[10px] opacity-80">{r.pts}</div>
            </div>
          ))}
        </div>
      </div>

      {/* タブ */}
      <div className="mx-4 mt-4 flex border-b border-gray-200">
        {(['customers', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold ${
              tab === t ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-400'
            }`}
          >
            {t === 'customers' ? `👥 会員一覧 (${customers.length})` : '📝 ポイント履歴'}
          </button>
        ))}
      </div>

      {sendMsg && (
        <div className="mx-4 mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">
          {sendMsg}
        </div>
      )}

      {tab === 'customers' && (
        <>
          <div className="mx-4 mt-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="名前で検索..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          <div className="mx-4 mt-3 space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
                <p className="text-4xl mb-2">👥</p>
                <p className="text-sm font-semibold">LINE会員がまだいません</p>
                <p className="text-xs mt-1">お客様がLINE公式アカウントを登録すると自動で表示されます</p>
              </div>
            ) : (
              filtered.map(c => {
                const rank = getRank(c.points)
                const lastVisit = c.last_visit_at
                  ? new Date(c.last_visit_at).toLocaleDateString('ja-JP')
                  : '未記録'
                return (
                  <div key={c.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${rank.color}`}>
                            {rank.icon} {rank.label}
                          </span>
                        </div>
                        <p className="font-bold text-gray-900 truncate">{c.display_name ?? '（名前未設定）'}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span>来店 {c.visit_count}回</span>
                          <span>累計 ¥{c.total_spent.toLocaleString()}</span>
                          <span>最終 {lastVisit}</span>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="text-xl font-black text-orange-600">{c.points.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">ポイント</p>
                      </div>
                    </div>
                    {c.line_user_id && (
                      <button
                        onClick={() => handleSendCoupon(c.id, c.line_user_id!)}
                        className="mt-3 w-full bg-green-600 text-white text-xs font-bold py-2 rounded-lg active:scale-95 transition-transform"
                      >
                        🎫 クーポンをLINE送信
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="mx-4 mt-3 bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {transactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">取引履歴がありません</p>
          ) : (
            transactions.map(t => (
              <div key={t.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {t.customer?.display_name ?? '不明'}
                  </p>
                  <p className="text-xs text-gray-400">{t.description ?? t.type}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(t.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <p className={`font-bold text-base ${t.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t.points >= 0 ? '+' : ''}{t.points}pt
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
