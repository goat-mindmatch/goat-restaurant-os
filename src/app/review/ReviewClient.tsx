'use client'

import { useState, useRef } from 'react'

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
const GOOGLE_REVIEW_URL = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
  : 'https://www.google.com/maps/search/人類みなまぜそば'

type Stage = 'select' | 'upload_screenshot' | 'completed'
type Verdict = 'approve' | 'review' | 'reject'

export default function ReviewClient({
  staffList, customerLineUserId,
}: {
  staffList: { id: string; name: string }[]
  customerLineUserId: string | null
}) {
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [stage, setStage] = useState<Stage>('select')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // スクショ関連
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // 結果
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [verdictReason, setVerdictReason] = useState<string>('')
  const [couponCode, setCouponCode] = useState<string | null>(null)

  // リセット
  const handleReset = () => {
    setSelectedStaff(null)
    setStage('select')
    setReviewId(null)
    setPreviewUrl(null)
    setError(null)
    setVerdict(null)
    setCouponCode(null)
  }

  // ① スタッフ選択 → Google開く → スクショ待ち画面へ
  const handleGoToGoogle = async () => {
    if (!selectedStaff) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
          customer_line_user_id: customerLineUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReviewId(data.review_id)
      window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer')
      setStage('upload_screenshot')
    } catch (e) {
      setError((e as Error).message)
    }
    setSubmitting(false)
  }

  // ② 画像選択 → プレビュー + リサイズ
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        // リサイズ（最大1200px）
        const MAX = 1200
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setPreviewUrl(dataUrl)
        setError(null)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // ③ アップロード → AI判定
  const handleUpload = async () => {
    if (!previewUrl || !reviewId) return
    setUploading(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/upload-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          image_base64: previewUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.verdict === 'reject') {
          setVerdict('reject')
          setVerdictReason(data.reason ?? '画像の検証に失敗しました')
          setStage('completed')
        } else {
          throw new Error(data.error ?? 'エラー')
        }
        return
      }

      setVerdict(data.verdict)
      setVerdictReason(data.reason ?? '')
      setCouponCode(data.coupon_code ?? null)
      setStage('completed')
    } catch (e) {
      setError((e as Error).message)
    }
    setUploading(false)
  }

  // ===== ステージ1：スタッフ選択 =====
  if (stage === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50">
        <div className="p-6 text-center">
          <p className="text-5xl mb-2">🍜</p>
          <h1 className="text-2xl font-bold text-gray-800">ご来店ありがとうございました</h1>
          <p className="text-sm text-gray-600 mt-2">本日の担当スタッフを選んでください</p>
        </div>
        <div className="px-4 pb-8">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="grid grid-cols-2 gap-2">
              {staffList.map(s => (
                <button key={s.id} onClick={() => setSelectedStaff(s)}
                  className={`py-4 rounded-xl font-bold text-base transition-all ${
                    selectedStaff?.id === s.id
                      ? 'bg-orange-500 text-white ring-4 ring-orange-200'
                      : 'bg-gray-50 text-gray-700 border border-gray-200'
                  }`}>
                  {s.name}
                  {selectedStaff?.id === s.id && <span className="block text-xs mt-1">✓</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedStaff({ id: 'nominee', name: '指名なし' })}
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
          </div>
          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
        </div>
      </div>
    )
  }

  // ===== ステージ2：スクショアップロード =====
  if (stage === 'upload_screenshot') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
        <div className="p-5">
          {/* ガイド */}
          <div className="text-center mb-5">
            <p className="text-5xl mb-2">📸</p>
            <h2 className="text-xl font-bold text-gray-800">口コミのスクショを送ってください</h2>
            <p className="text-xs text-gray-500 mt-1">{selectedStaff?.name}さんの接客について</p>
          </div>

          {/* 手順 */}
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <p className="text-sm font-bold text-gray-800 mb-3">📱 手順</p>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="font-medium">Google で口コミを投稿する</p>
                  <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-red-500 underline">→ 投稿画面を開く</a>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="font-medium">投稿完了画面をスクリーンショット</p>
                  <p className="text-xs text-gray-500">「投稿しました」等の画面、または自分の口コミが表示されている画面</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="font-medium">下のボタンからスクショを送信</p>
                </div>
              </div>
            </div>
          </div>

          {/* アップロードエリア */}
          <input type="file" ref={fileInputRef} accept="image/*"
            onChange={handleFileSelect} className="hidden" />

          {!previewUrl ? (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white border-2 border-dashed border-blue-300 rounded-2xl py-10 flex flex-col items-center gap-3 hover:border-blue-500 transition-colors">
              <span className="text-4xl">🖼️</span>
              <span className="text-blue-600 font-bold">写真フォルダからスクショを選択</span>
              <span className="text-xs text-gray-400">撮影済みのスクリーンショットを選んでください</span>
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <img src={previewUrl} alt="preview" className="w-full max-h-80 object-contain bg-gray-100" />
              <div className="p-3 flex gap-2">
                <button onClick={() => { setPreviewUrl(null); if(fileInputRef.current) fileInputRef.current.value = '' }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium">撮り直す</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="flex-[2] bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-lg text-sm font-bold">
                  {uploading ? '🤖 AI確認中...' : '✅ この画像で提出する'}
                </button>
              </div>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}

          {/* やり直し */}
          <button onClick={handleReset} className="block w-full text-gray-400 text-xs mt-4 underline text-center">
            ↺ 最初からやり直す
          </button>
        </div>
      </div>
    )
  }

  // ===== ステージ3：結果表示 =====
  return (
    <div className={`min-h-screen ${
      verdict === 'approve' ? 'bg-gradient-to-br from-green-50 to-emerald-100'
      : verdict === 'reject' ? 'bg-gradient-to-br from-red-50 to-orange-50'
      : 'bg-gradient-to-br from-amber-50 to-yellow-50'
    }`}>
      <div className="p-6">
        {/* 承認 */}
        {verdict === 'approve' && (
          <>
            <div className="text-center py-6">
              <p className="text-6xl mb-3">🎉</p>
              <h1 className="text-2xl font-bold text-gray-800">口コミを確認できました！</h1>
              <p className="text-sm text-gray-600 mt-2">
                {selectedStaff?.name}さんの接客として記録しました
              </p>
            </div>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white text-center">
                <p className="text-xs font-semibold opacity-80">口コミ特典</p>
                <p className="text-2xl font-bold mt-1">ありがとうございます！</p>
              </div>
              <div className="p-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-dashed border-green-300 rounded-2xl p-5 text-center">
                  <p className="text-xs text-gray-500">クーポンコード</p>
                  <p className="text-3xl font-bold text-green-600 tracking-wider my-2 select-all">
                    {couponCode}
                  </p>
                  <p className="text-xs text-gray-500">次回来店時にスタッフへ提示</p>
                </div>
                <div className="mt-4 bg-blue-50 rounded-xl p-3 text-xs text-blue-800">
                  📱 この画面をスクショして保存しておくと便利です
                </div>
              </div>
            </div>
          </>
        )}

        {/* 要手動確認 */}
        {verdict === 'review' && (
          <>
            <div className="text-center py-6">
              <p className="text-6xl mb-3">⏳</p>
              <h1 className="text-xl font-bold text-gray-800">スタッフ確認中です</h1>
              <p className="text-sm text-gray-600 mt-2">
                画像の確認に少しお時間をいただきます
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <p className="text-sm text-gray-700 mb-3">
                {verdictReason || 'AI による自動判定ができませんでした'}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-bold mb-1">📱 次回ご来店時に</p>
                <p className="text-xs">スタッフにこの画面をお見せください。確認後、特典をお渡しします。</p>
              </div>
              {couponCode && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">確認コード</p>
                  <p className="text-xl font-bold text-gray-600">{couponCode}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* 却下 */}
        {verdict === 'reject' && (
          <>
            <div className="text-center py-6">
              <p className="text-6xl mb-3">⚠️</p>
              <h1 className="text-xl font-bold text-gray-800">確認できませんでした</h1>
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-sm text-gray-700 mb-4">{verdictReason}</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800">
                <p className="font-bold mb-1">📱 もう一度お試しください</p>
                <p>Google で口コミを投稿した後、投稿完了画面のスクリーンショットを撮影してください。</p>
              </div>
            </div>
          </>
        )}

        <div className="text-center mt-6 text-sm text-gray-500">
          またのご来店をお待ちしております 🙌
        </div>
        <div className="text-center mt-3">
          <button onClick={handleReset} className="text-xs text-gray-400 underline">↺ 最初からやり直す</button>
        </div>
      </div>
    </div>
  )
}
