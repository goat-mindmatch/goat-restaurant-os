'use client'

import { useState } from 'react'

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
const GOOGLE_MAPS_URL = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/reviews?placeid=${GOOGLE_PLACE_ID}`
  : 'https://www.google.com/maps/search/人類みなまぜそば'

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

export default function VerifyClient({ staffLineUserId }: { staffLineUserId: string | null }) {
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<ReviewInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

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

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!info) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: info.review_id,
          action,
          staff_line_user_id: staffLineUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラー')
      setResult(action === 'approve' ? '✅ 承認しました！特典を適用してください' : '❌ 却下しました')
      setInfo(null)
      setCode('')
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  // 表示用フォーマッタ
  const fmtTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-'

  const getStatus = () => {
    if (!info) return null
    if (info.verified_at) return { label: '✅ 承認済み', color: 'bg-green-100 text-green-700' }
    if (info.completed) return { label: '⏳ 承認待ち', color: 'bg-amber-100 text-amber-700' }
    return { label: '📝 未完了（申告なし）', color: 'bg-gray-100 text-gray-600' }
  }

  const status = getStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-6 shadow-lg">
        <h1 className="text-2xl font-bold">🔍 クーポン検証</h1>
        <p className="text-blue-100 text-sm mt-1">
          お客様が提示した検証コードを入力してください
        </p>
      </div>

      {/* 結果トースト */}
      {result && (
        <div className="mx-4 mt-4 bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center">
          <p className="text-green-800 font-bold text-lg">{result}</p>
          <button onClick={() => setResult(null)} className="text-xs text-green-600 underline mt-2">閉じる</button>
        </div>
      )}

      {/* コード入力 */}
      <form onSubmit={handleLookup} className="p-4">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <label className="text-sm font-semibold text-gray-700 mb-2 block">検証コード</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="例: MZ0416-A8K2"
            autoComplete="off"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-xl font-mono tracking-wider text-center uppercase focus:border-blue-500 focus:outline-none"
          />
          <button type="submit" disabled={loading || !code.trim()}
            className="w-full mt-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-base">
            {loading ? '検索中...' : '🔎 コードを検索'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mx-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 情報表示 */}
      {info && (
        <div className="mx-4 mt-3">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* ステータスバッジ */}
            <div className={`px-4 py-3 text-center font-bold ${status?.color}`}>
              {status?.label}
            </div>

            <div className="p-5 space-y-3 text-sm">
              <InfoRow label="対象スタッフ" value={info.staff_name ?? '指名なし'} bold />
              <InfoRow label="口コミクリック日時" value={fmtTime(info.clicked_at)} />
              <InfoRow label="申告日時" value={info.completed ? fmtTime(info.completed_at) : '未申告'} />
              {info.verified_at && (
                <InfoRow label="承認済み" value={`${fmtTime(info.verified_at)} by ${info.verified_by_name ?? '?'}`} />
              )}
            </div>

            {/* ペーストされた口コミ本文（最重要！） */}
            {info.review_text && (
              <div className="mx-5 mb-4 bg-purple-50 border-2 border-purple-200 rounded-xl overflow-hidden">
                <div className="bg-purple-100 px-3 py-2">
                  <p className="font-bold text-purple-900 text-sm">📝 お客様が申告した口コミ本文</p>
                  <p className="text-[10px] text-purple-700">Google上の実際の口コミと照合してください</p>
                </div>
                <div className="p-3 text-sm text-gray-800 whitespace-pre-wrap bg-white max-h-60 overflow-y-auto">
                  {info.review_text}
                </div>
              </div>
            )}

            {/* 既に承認済みなら何もさせない */}
            {info.verified_at ? (
              <div className="p-4 bg-gray-50 border-t text-center text-sm text-gray-500">
                既に検証済みです
              </div>
            ) : (
              <>
                {/* Google レビュー確認ガイド */}
                <div className="mx-4 mb-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
                  <p className="font-semibold mb-1">📱 確認手順</p>
                  <ol className="list-decimal list-inside text-xs space-y-1">
                    <li>お客様にスマホの Google レビュー画面を見せてもらう</li>
                    <li>店舗のレビューに投稿されているか確認</li>
                    <li>存在すれば「承認」、なければ「却下」</li>
                  </ol>
                  <a href={GOOGLE_MAPS_URL} target="_blank" rel="noreferrer"
                    className="mt-2 inline-block text-blue-600 underline text-xs">
                    → 店舗のGoogleレビューを開く
                  </a>
                </div>

                <div className="p-4 border-t grid grid-cols-2 gap-2">
                  <button onClick={() => handleAction('reject')} disabled={loading}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl">
                    ❌ 却下
                  </button>
                  <button onClick={() => handleAction('approve')} disabled={loading}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl">
                    ✅ 承認
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* スタッフ情報表示 */}
      {!info && !error && !result && (
        <div className="mx-4 mt-4 bg-white rounded-xl p-4 text-sm text-gray-600 shadow-sm">
          <p className="font-semibold mb-2">📋 このページの使い方</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>お客様がクーポン画面をスマホで提示</li>
            <li>画面に表示されている「検証コード」を上のフォームに入力</li>
            <li>詳細が表示されたら、お客様の Google レビューを見せてもらう</li>
            <li>承認 or 却下をタップ</li>
          </ol>
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
            💡 このページを**ブックマーク**しておくと便利です
          </p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center pb-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`${bold ? 'font-bold text-base text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
