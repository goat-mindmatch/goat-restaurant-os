'use client'

import { useState, useEffect } from 'react'

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
const GOOGLE_REVIEW_URL = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
  : 'https://www.google.com/maps/search/人類みなまぜそば'

type Stage = 'select' | 'awaiting_completion' | 'completed'

type CompletionResult = {
  staff_name: string | null
  coupon_code: string
}

const LS_KEY = 'goat_pending_review'

export default function ReviewClient({
  staffList, customerLineUserId,
}: {
  staffList: { id: string; name: string }[]
  customerLineUserId: string | null
}) {
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [stage, setStage] = useState<Stage>('select')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [completion, setCompletion] = useState<CompletionResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewText, setReviewText] = useState('')

  // 戻ってきた時の状態復元（+ 古いデータ自動クリーンアップ）
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    try {
      const p = JSON.parse(raw)
      // 30分以内なら復元を試みる
      if (Date.now() - p.timestamp < 30 * 60 * 1000) {
        // review_id が既に完了or検証済みなら、自動でクリア
        fetch(`/api/reviews/check?review_id=${p.review_id}`)
          .then(r => r.json())
          .then(data => {
            if (data.completed || !data.exists) {
              // 既に処理済みのレビュー → クリア
              localStorage.removeItem(LS_KEY)
              setStage('select')
            } else {
              // まだ未処理 → 復元
              setSelectedStaff(p.staff)
              setReviewId(p.review_id)
              setStage('awaiting_completion')
            }
          })
          .catch(() => {
            localStorage.removeItem(LS_KEY)
          })
      } else {
        localStorage.removeItem(LS_KEY)
      }
    } catch {
      localStorage.removeItem(LS_KEY)
    }
  }, [])

  // 最初からやり直す
  const handleReset = () => {
    localStorage.removeItem(LS_KEY)
    setSelectedStaff(null)
    setReviewId(null)
    setCompletion(null)
    setError(null)
    setStage('select')
  }

  // スタッフ選択後 → Googleオープン + 即座に完了画面を表示
  const handleGoToGoogle = async () => {
    if (!selectedStaff) return
    setSubmitting(true)
    setError(null)
    try {
      // クリック & 完了を一度に記録（簡易確認コード発行）
      const res = await fetch('/api/reviews/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
          customer_line_user_id: customerLineUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラー')

      setReviewId(data.review_id)
      setCompletion({
        staff_name: selectedStaff.name,
        coupon_code: data.coupon_code,
      })

      // Google投稿画面を別タブで開く
      window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer')

      // 完了画面へ直接遷移（中間ステージ廃止）
      setStage('completed')
      localStorage.removeItem(LS_KEY)
    } catch (e) {
      setError((e as Error).message)
    }
    setSubmitting(false)
  }

  // ===== ステージ1：スタッフ選択 =====
  if (stage === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50">
        <div className="p-6 text-center">
          <p className="text-5xl mb-2">🍜</p>
          <h1 className="text-2xl font-bold text-gray-800">ご来店ありがとうございました</h1>
          <p className="text-sm text-gray-600 mt-2">
            本日の接客はいかがでしたか？<br />
            担当したスタッフを選んでください
          </p>
        </div>

        <div className="px-4 pb-8">
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3 text-center">本日の担当スタッフ</p>
            <div className="grid grid-cols-2 gap-2">
              {staffList.map(s => (
                <button key={s.id}
                  onClick={() => setSelectedStaff(s)}
                  className={`py-4 rounded-xl font-bold text-base transition-all ${
                    selectedStaff?.id === s.id
                      ? 'bg-orange-500 text-white ring-4 ring-orange-200'
                      : 'bg-gray-50 text-gray-700 border border-gray-200'
                  }`}>
                  {s.name}
                  {selectedStaff?.id === s.id && <span className="block text-xs mt-1">✓ 選択中</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedStaff({ id: 'nominee', name: '特に指名なし' })}
              className={`w-full mt-2 py-3 rounded-xl text-sm ${
                selectedStaff?.id === 'nominee' ? 'bg-gray-600 text-white' : 'bg-gray-50 text-gray-500 border'
              }`}>
              わからない / 指名なし
            </button>
          </div>

          <div className="mt-6">
            <button onClick={handleGoToGoogle}
              disabled={!selectedStaff || submitting}
              className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-lg shadow-lg">
              {submitting ? '準備中...' : '⭐ Googleで口コミを書く'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              タップすると口コミ投稿画面が別タブで開きます
            </p>
          </div>

          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
        </div>
      </div>
    )
  }

  // ===== ステージ2は廃止（click直後にcompletedへ） =====
  if (stage === 'awaiting_completion') {
    // localStorage由来の古い状態があった場合用の救済ビュー
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow text-center">
          <p className="text-4xl mb-3">🔄</p>
          <p className="text-gray-700 mb-4">前回の途中データが残っているようです</p>
          <button onClick={handleReset}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl">
            最初からやり直す
          </button>
        </div>
      </div>
    )
  }

  // ===== 完了・確認コード画面 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="p-6">
        {/* サクセス表示 */}
        <div className="text-center py-6">
          <p className="text-6xl mb-3">🙏</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">ご協力ありがとうございます</h1>
          <p className="text-sm text-gray-600 mt-2">
            {completion?.staff_name && `${completion.staff_name}${completion.staff_name !== '指名なし' ? 'さん' : ''}の接客として受付けました`}
          </p>
        </div>

        {/* Googleレビューを書いてね強調 */}
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-4 text-center">
          <p className="text-4xl mb-2">⭐</p>
          <p className="font-bold text-red-800 mb-1">別タブでGoogle投稿画面が開きました</p>
          <p className="text-xs text-red-700">
            そちらで口コミのご投稿をお願いします<br />
            投稿後は自動で特典をお送りします
          </p>
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-3 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm">
            ⭐ Google投稿画面を開く
          </a>
        </div>

        {/* 確認コードカード */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-5 text-white">
            <p className="text-xs font-semibold opacity-80">もし自動で確認できなかった時の保険</p>
            <p className="text-base font-bold mt-1">確認コード</p>
          </div>
          <div className="p-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-indigo-300 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-indigo-600 tracking-wider my-1 select-all">
                {completion?.coupon_code}
              </p>
              <p className="text-[10px] text-gray-400">発行: {new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800">
              <p className="font-bold mb-1.5">📱 このあとの流れ</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Googleで口コミを投稿してください</li>
                <li>システムが自動検知すると LINE で特典コードをお送りします（数分〜数時間）</li>
                <li>万が一自動で確認できなかった場合は、次回来店時にこの画面を見せてください</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          またのご来店を<br />心よりお待ちしております 🙌
        </div>

        {/* やり直し */}
        <div className="text-center mt-4">
          <button onClick={handleReset}
            className="text-xs text-gray-400 underline">
            ↺ 最初からやり直す
          </button>
        </div>
      </div>
    </div>
  )
}
