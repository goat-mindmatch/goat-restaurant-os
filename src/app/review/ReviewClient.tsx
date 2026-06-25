'use client'

import { useState } from 'react'

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
const GOOGLE_REVIEW_URL = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
  : 'https://www.google.com/maps/search/人類みなまぜそば'

type Stage = 'landing' | 'done'

export default function ReviewClient({
  customerLineUserId,
}: {
  customerLineUserId: string | null
}) {
  const [stage, setStage] = useState<Stage>('landing')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState<string | null>(null)

  const handleReset = () => {
    setStage('landing')
    setError(null)
    setCouponCode(null)
  }

  const handleStartReview = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: null,
          customer_line_user_id: customerLineUserId,
          platform: 'google',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCouponCode(data.coupon_code)
      const opened = window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer')
      if (!opened) {
        setError('ポップアップがブロックされました。ブラウザの許可を確認して再度お試しください。')
      }
      setStage('done')
    } catch (e) {
      setError((e as Error).message)
    }
    setSubmitting(false)
  }

  // ===== ステージ1：導線開始 =====
  if (stage === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50">
        <div className="p-6 text-center">
          <p className="text-5xl mb-2">🍜</p>
          <h1 className="text-2xl font-bold text-gray-800">ご来店ありがとうございました</h1>
          <p className="text-sm text-gray-600 mt-2">Googleで口コミを書いてくれたお客様へ、クーポンを先にお渡しできます</p>
          <p className="text-xs text-gray-500 mt-2">特典: 200円以下トッピング1品無料</p>
        </div>
        <div className="px-4 pb-8">
          <div className="bg-white rounded-2xl shadow p-4">
            <button onClick={handleStartReview} disabled={submitting}
              className="w-full bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-2xl shadow p-5 text-left border-2 border-transparent active:scale-95">
              <div className="flex items-center gap-4">
                <span className="text-4xl">🔍</span>
                <div className="flex-1">
                  <p className="font-bold text-white text-lg">Googleで口コミを書く</p>
                  <p className="text-sm text-red-100">タップでGoogle投稿画面を開く</p>
                </div>
                <span className="text-2xl text-white/60">›</span>
              </div>
            </button>
            {submitting && <p className="text-center text-sm text-gray-500 mt-3">クーポンを発行中です...</p>}
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mt-3">{error}</div>}
          </div>
        </div>
      </div>
    )
  }
  // ===== ステージ2：結果表示 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="p-6">
        <div className="text-center py-6">
          <p className="text-6xl mb-3">🎉</p>
          <h1 className="text-2xl font-bold text-gray-800">クーポンを発行しました</h1>
          <p className="text-sm text-gray-600 mt-2">Google投稿画面を開きました。投稿後、次回来店時にスタッフへ提示してください。</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white text-center">
            <p className="text-xs font-semibold opacity-80">口コミ特典</p>
            <p className="text-2xl font-bold mt-1">200円以下トッピング1品無料</p>
          </div>
          <div className="p-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-dashed border-green-300 rounded-2xl p-5 text-center">
              <p className="text-xs text-gray-500">クーポンコード</p>
              <p className="text-3xl font-bold text-green-600 tracking-wider my-2 select-all">{couponCode}</p>
              <p className="text-xs text-gray-500">次回来店時にスタッフへ提示してください</p>
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              ⚠️ 200円以下のトッピング1品に限り適用。他の割引との併用不可。
            </div>
            <div className="mt-3 bg-blue-50 rounded-xl p-3 text-xs text-blue-800">
              この画面を閉じる前にコードを保存してください。
            </div>
          </div>
        </div>
        <div className="text-center mt-6 text-sm text-gray-500">またのご来店をお待ちしております 🙌</div>
        <div className="text-center mt-3">
          <button onClick={handleReset} className="text-xs text-gray-400 underline">もう一度受け付ける</button>
        </div>
      </div>
    </div>
  )
}
