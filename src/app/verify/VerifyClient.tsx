'use client'

import { useState, useEffect } from 'react'

type ReviewInfo = {
  review_id: string
  staff_name: string | null
  clicked_at: string
  completed: boolean
  completed_at: string | null
  verified_at: string | null
  verified_by_name: string | null
  review_text: string | null
}

type PendingReview = {
  id: string
  staff_name: string
  clicked_at: string
  coupon_code: string | null
  screenshot_verdict: string | null
  customer_line_user_id: string | null
}

export default function VerifyClient({ staffLineUserId }: { staffLineUserId: string | null }) {
  const [pendingList, setPendingList] = useState<PendingReview[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const [code, setCode] = useState('')
  const [info, setInfo] = useState<ReviewInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  // 確認待ちリストを自動取得
  useEffect(() => {
    fetch('/api/reviews/pending')
      .then(r => r.json())
      .then(data => setPendingList(data.reviews ?? []))
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/reviews/verify?code=${encodeURIComponent(code.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラー')
      setInfo(data)
    } catch (e) {
      setError((e as Error).message)
      setInfo(null)
    }
    setLoading(false)
  }

  const handleAction = async (action: 'approve' | 'reject', reviewId?: string) => {
    const targetId = reviewId ?? info?.review_id
    if (!targetId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: targetId,
          action,
          staff_line_user_id: staffLineUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラー')
      setResult(action === 'approve' ? '✅ 承認しました！お客様のLINEに特典を送信しました' : '❌ 却下しました')
      setInfo(null)
      setCode('')
      // リスト再取得
      setPendingList(prev => prev.filter(p => p.id !== targetId))
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  const fmtTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-'

  const getStatus = () => {
    if (!info) return null
    if (info.verified_at) return { label: '✅ 承認済み', color: 'bg-green-100 text-green-700' }
    if (info.completed) return { label: '⏳ 承認待ち', color: 'bg-amber-100 text-amber-700' }
    return { label: '📝 未完了', color: 'bg-gray-100 text-gray-600' }
  }

  const parseVerdict = (json: string | null) => {
    if (!json) return null
    try { return JSON.parse(json) } catch { return null }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold">🔍 口コミ検証</h1>
        <p className="text-blue-100 text-sm mt-1">確認待ちの口コミを承認してください</p>
      </div>

      {/* 結果トースト */}
      {result && (
        <div className="mx-4 mt-4 bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center">
          <p className="text-green-800 font-bold">{result}</p>
          <button onClick={() => setResult(null)} className="text-xs text-green-600 underline mt-1">閉じる</button>
        </div>
      )}

      {/* ======= 確認待ちリスト ======= */}
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">
          ⏳ 確認待ち（{pendingList.length}件）
        </h2>

        {loadingList ? (
          <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : pendingList.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">
            確認待ちの口コミはありません
          </div>
        ) : (
          <div className="space-y-2">
            {pendingList.map(r => {
              const v = parseVerdict(r.screenshot_verdict)
              return (
                <div key={r.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{r.staff_name}</p>
                        <p className="text-xs text-gray-400">{fmtTime(r.clicked_at)}</p>
                      </div>
                      {v && (
                        <span className={`text-[10px] px-2 py-1 rounded-full ${
                          v.verdict === 'approve' ? 'bg-green-100 text-green-700'
                          : v.verdict === 'reject' ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          AI: {v.verdict === 'approve' ? '承認推奨' : v.verdict === 'reject' ? '要注意' : '要確認'}
                        </span>
                      )}
                    </div>

                    {/* AI判定理由 */}
                    {v?.reason && (
                      <div className="bg-gray-50 rounded-lg p-2 mb-3 text-xs text-gray-700">
                        🤖 {v.reason}
                      </div>
                    )}

                    {/* 承認/却下ボタン */}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleAction('reject', r.id)} disabled={loading}
                        className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl text-sm">
                        ❌ 却下
                      </button>
                      <button onClick={() => handleAction('approve', r.id)} disabled={loading}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl text-sm">
                        ✅ 承認
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ======= コード検索（フォールバック） ======= */}
      <div className="p-4 border-t border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">🔎 コードで検索</h2>
        <form onSubmit={handleLookup}>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <input type="text" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="例: MZ0417-A8K2"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-mono tracking-wider text-center uppercase focus:border-blue-500 focus:outline-none"
            />
            <button type="submit" disabled={loading || !code.trim()}
              className="w-full mt-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl text-sm">
              {loading ? '検索中...' : '検索'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mx-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* コード検索結果 */}
      {info && (
        <div className="mx-4 mt-3 mb-4">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className={`px-4 py-3 text-center font-bold ${getStatus()?.color}`}>
              {getStatus()?.label}
            </div>
            <div className="p-5 space-y-3 text-sm">
              <InfoRow label="対象スタッフ" value={info.staff_name ?? '指名なし'} bold />
              <InfoRow label="申告日時" value={fmtTime(info.clicked_at)} />
              {info.verified_at && (
                <InfoRow label="承認済み" value={`${fmtTime(info.verified_at)} by ${info.verified_by_name ?? '?'}`} />
              )}
            </div>
            {!info.verified_at && (
              <div className="p-4 border-t grid grid-cols-2 gap-2">
                <button onClick={() => handleAction('reject')} disabled={loading}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl">❌ 却下</button>
                <button onClick={() => handleAction('approve')} disabled={loading}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl">✅ 承認</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center pb-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={bold ? 'font-bold text-base text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  )
}
