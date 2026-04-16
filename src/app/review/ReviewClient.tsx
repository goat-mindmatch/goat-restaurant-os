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

  const handleGoToGoogle = async () => {
    if (!selectedStaff) return
    setSubmitting(true)
    setError(null)
    try {
      // クリック記録
      const res = await fetch('/api/reviews/click', {
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

      // localStorage に保存（戻ってきた時復元用）
      localStorage.setItem(LS_KEY, JSON.stringify({
        staff: selectedStaff,
        review_id: data.review_id,
        timestamp: Date.now(),
      }))

      // Google投稿画面を開く（別タブ）
      window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer')

      // 画面を「書き終わった？」ステージに遷移
      setStage('awaiting_completion')
    } catch (e) {
      setError((e as Error).message)
    }
    setSubmitting(false)
  }

  const handleConfirmCompleted = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: reviewId, uid: customerLineUserId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラー')
      setCompletion({
        staff_name: data.staff_name,
        coupon_code: data.coupon_code ?? 'MZ-OK',
      })
      localStorage.removeItem(LS_KEY)
      setStage('completed')
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

  // ===== ステージ2：書き終わったか確認 =====
  if (stage === 'awaiting_completion') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl">
          <div className="text-center mb-6">
            <p className="text-6xl mb-4">✍️</p>
            <h2 className="text-xl font-bold text-gray-800">Googleで口コミを書き終わりましたか？</h2>
            {selectedStaff && (
              <p className="text-sm text-gray-500 mt-2">
                {selectedStaff.name}さんの接客について
              </p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-800">
            💡 まだの方は先に下のボタンから投稿画面を開いてください
          </div>

          {/* 書いた → 完了ボタン */}
          <button onClick={handleConfirmCompleted}
            disabled={submitting}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-5 rounded-2xl text-lg shadow-lg mb-3">
            {submitting ? '処理中...' : '✅ 書きました！特典を受け取る'}
          </button>

          {/* まだの方用 再オープン */}
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
            className="block w-full border-2 border-red-300 text-red-500 font-semibold py-3 rounded-xl text-center text-sm">
            ⭐ もう一度 Google 投稿画面を開く
          </a>

          {/* やり直し */}
          <button onClick={handleReset}
            className="block w-full text-gray-400 text-xs mt-4 underline">
            ↺ 最初からやり直す
          </button>

          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
        </div>
      </div>
    )
  }

  // ===== ステージ3：完了・検証待ち画面 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="p-6">
        {/* サクセス表示 */}
        <div className="text-center py-6">
          <p className="text-6xl mb-3">🙏</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">ご協力ありがとうございました</h1>
          <p className="text-sm text-gray-600 mt-2">
            {completion?.staff_name && `${completion.staff_name}${completion.staff_name !== '指名なし' ? 'さん' : ''}の接客として`}<br />
            受付けました
          </p>
        </div>

        {/* 検証コードカード */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-5 text-white">
            <p className="text-xs font-semibold opacity-80">次回ご来店時に提示する検証コード</p>
            <p className="text-lg font-bold mt-1">スタッフにこの画面をお見せください</p>
          </div>
          <div className="p-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-indigo-300 rounded-2xl p-5 text-center">
              <p className="text-xs text-gray-500">検証コード</p>
              <p className="text-3xl font-bold text-indigo-600 tracking-wider my-2 select-all">
                {completion?.coupon_code}
              </p>
              <p className="text-xs text-gray-500">発行: {new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {/* 重要な説明 */}
            <div className="mt-5 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-sm">
              <p className="font-bold text-amber-900 mb-2">📱 ご利用方法</p>
              <ol className="list-decimal list-inside space-y-1.5 text-amber-800 text-xs">
                <li>次回ご来店時に<b>この画面をスタッフにお見せ</b>ください</li>
                <li>スタッフが<b>Googleレビュー</b>を確認します</li>
                <li>確認後、<b>特典をお渡し</b>します</li>
              </ol>
            </div>

            <div className="mt-4 bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
              💡 画面スクショやLINEに保存しておくと便利です
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          またのご来店を<br />心よりお待ちしております 🙌
        </div>

        {/* やり直し（テスト用） */}
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
