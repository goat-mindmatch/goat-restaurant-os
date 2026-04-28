'use client'

import { useState, useRef } from 'react'

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
const GOOGLE_REVIEW_URL = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
  : 'https://www.google.com/maps/search/人類みなまぜそば'

// 食べログURL（吹田店）
// 食べログ：人類みなまぜそば 吹田店
const TABELOG_URL = 'https://s.tabelog.com/osaka/A2706/A270602/27139786/'

type Stage = 'select_staff' | 'select_platform' | 'upload_screenshot' | 'completed'
type Platform = 'google' | 'tabelog' | 'both'
type Verdict = 'approve' | 'review' | 'reject'

const PLATFORM_INFO: Record<Platform, { label: string; icon: string; bonus: number; color: string; url: string }> = {
  google:  { label: 'Google',       icon: '🔍', bonus: 100, color: 'bg-red-500',    url: GOOGLE_REVIEW_URL },
  tabelog: { label: '食べログ',      icon: '🍽', bonus: 100, color: 'bg-orange-500', url: TABELOG_URL },
  both:    { label: 'どちらも書く',  icon: '🎁', bonus: 200, color: 'bg-purple-500', url: GOOGLE_REVIEW_URL },
}

export default function ReviewClient({
  staffList, customerLineUserId,
}: {
  staffList: { id: string; name: string }[]
  customerLineUserId: string | null
}) {
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [stage, setStage] = useState<Stage>('select_staff')
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 「両方」の場合: どちらを先にやっているか
  const [bothStep, setBothStep] = useState<'google' | 'tabelog'>('google')

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [verdictReason, setVerdictReason] = useState<string>('')
  const [couponCode, setCouponCode] = useState<string | null>(null)

  const handleReset = () => {
    setSelectedStaff(null); setPlatform(null); setStage('select_staff')
    setReviewId(null); setPreviewUrl(null); setError(null)
    setVerdict(null); setCouponCode(null); setBothStep('google')
  }

  // スタッフ選択 → プラットフォーム選択へ
  const handleSelectStaff = (staff: { id: string; name: string }) => {
    setSelectedStaff(staff)
    setStage('select_platform')
  }

  // プラットフォーム選択 → 口コミ記録 → サイトを開く
  const handleSelectPlatform = async (p: Platform) => {
    setPlatform(p)
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff!.id === 'nominee' ? null : selectedStaff!.id,
          customer_line_user_id: customerLineUserId,
          platform: p,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReviewId(data.review_id)
      // サイトを開く（両方の場合はまずGoogle）
      const openUrl = p === 'tabelog' ? TABELOG_URL : GOOGLE_REVIEW_URL
      window.open(openUrl, '_blank', 'noopener,noreferrer')
      setStage('upload_screenshot')
    } catch (e) {
      setError((e as Error).message)
    }
    setSubmitting(false)
  }

  // 画像選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('画像ファイルを選択してください'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
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
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85))
        setError(null)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // スクショアップロード → AI判定
  const handleUpload = async () => {
    if (!previewUrl || !reviewId) return
    setUploading(true); setError(null)
    try {
      const currentPlatform = (platform === 'both' && bothStep === 'tabelog') ? 'tabelog' : 'google'
      const res = await fetch('/api/reviews/upload-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          image_base64: previewUrl,
          platform: currentPlatform,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.verdict === 'reject') {
          setVerdict('reject'); setVerdictReason(data.reason ?? '画像の検証に失敗しました')
          setStage('completed')
        } else {
          throw new Error(data.error ?? 'エラー')
        }
        return
      }

      // 「両方書く」の場合: Google完了 → 食べログへ誘導
      if (platform === 'both' && bothStep === 'google' && data.verdict === 'approve') {
        setBothStep('tabelog')
        setPreviewUrl(null)
        window.open(TABELOG_URL, '_blank', 'noopener,noreferrer')
        setUploading(false)
        return
      }

      setVerdict(data.verdict); setVerdictReason(data.reason ?? '')
      setCouponCode(data.coupon_code ?? null)
      setStage('completed')
    } catch (e) {
      setError((e as Error).message)
    }
    setUploading(false)
  }

  // ===== ステージ1：スタッフ選択 =====
  if (stage === 'select_staff') {
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
                <button key={s.id} onClick={() => handleSelectStaff(s)}
                  className="py-4 rounded-xl font-bold text-base bg-gray-50 text-gray-700 border border-gray-200 hover:bg-orange-50 hover:border-orange-300 transition-all active:scale-95">
                  {s.name}
                </button>
              ))}
            </div>
            <button onClick={() => handleSelectStaff({ id: 'nominee', name: '指名なし' })}
              className="w-full mt-2 py-3 rounded-xl text-sm bg-gray-50 text-gray-500 border hover:bg-gray-100">
              わからない / 指名なし
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== ステージ2：プラットフォーム選択 =====
  if (stage === 'select_platform') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50">
        <div className="p-6 text-center">
          <p className="text-5xl mb-2">⭐</p>
          <h1 className="text-xl font-bold text-gray-800">口コミを書いてください</h1>
          <p className="text-sm text-gray-500 mt-1">どちらのサイトに書きますか？</p>
        </div>
        <div className="px-4 pb-8 space-y-3">
          {/* Google */}
          <button onClick={() => handleSelectPlatform('google')} disabled={submitting}
            className="w-full bg-white rounded-2xl shadow p-5 text-left border-2 border-transparent hover:border-red-300 transition-all active:scale-95">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🔍</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-lg">Google で書く</p>
                <p className="text-sm text-gray-500">特典: 200円以下トッピング1品無料</p>
              </div>
              <span className="text-2xl text-gray-300">›</span>
            </div>
          </button>

          {/* 食べログ */}
          <button onClick={() => handleSelectPlatform('tabelog')} disabled={submitting}
            className="w-full bg-white rounded-2xl shadow p-5 text-left border-2 border-transparent hover:border-orange-300 transition-all active:scale-95">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🍽</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-lg">食べログ で書く</p>
                <p className="text-sm text-gray-500">特典: 200円以下トッピング1品無料</p>
              </div>
              <span className="text-2xl text-gray-300">›</span>
            </div>
          </button>

          {/* 両方 */}
          <button onClick={() => handleSelectPlatform('both')} disabled={submitting}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow p-5 text-left border-2 border-transparent active:scale-95">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🎁</span>
              <div className="flex-1">
                <p className="font-bold text-white text-lg">両方書く（おトク！）</p>
                <p className="text-sm text-purple-100">特典: <span className="font-bold text-white">200円以下トッピング2品無料</span></p>
              </div>
              <span className="text-2xl text-white/60">›</span>
            </div>
          </button>

          {submitting && <p className="text-center text-sm text-gray-500">準備中...</p>}
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

          <button onClick={() => setStage('select_staff')} className="block w-full text-gray-400 text-xs underline text-center pt-2">
            ← スタッフ選択に戻る
          </button>
        </div>
      </div>
    )
  }

  // ===== ステージ3：スクショアップロード =====
  if (stage === 'upload_screenshot') {
    const isBothTabelog = platform === 'both' && bothStep === 'tabelog'
    const currentSiteName = (platform === 'tabelog' || isBothTabelog) ? '食べログ' : 'Google'
    const currentUrl = (platform === 'tabelog' || isBothTabelog) ? TABELOG_URL : GOOGLE_REVIEW_URL
    const bgColor = (platform === 'tabelog' || isBothTabelog)
      ? 'from-orange-50 to-amber-50'
      : 'from-blue-50 to-indigo-50'

    return (
      <div className={`min-h-screen bg-gradient-to-b ${bgColor}`}>
        <div className="p-5">
          {platform === 'both' && (
            <div className="bg-purple-100 rounded-xl p-3 mb-4 text-center">
              <p className="text-xs font-bold text-purple-700">
                {bothStep === 'google' ? '① Google → ② 食べログ の順に書いてください' : '② 食べログを書いてください（最後！）'}
              </p>
            </div>
          )}

          <div className="text-center mb-5">
            <p className="text-5xl mb-2">📸</p>
            <h2 className="text-xl font-bold text-gray-800">{currentSiteName}のスクショを送ってください</h2>
            <p className="text-xs text-gray-500 mt-1">{selectedStaff?.name}さんの接客として記録します</p>
          </div>

          {/* 手順 */}
          <div className="bg-white rounded-2xl shadow p-4 mb-4">
            <p className="text-sm font-bold text-gray-800 mb-3">📱 手順</p>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="font-medium">{currentSiteName} で口コミを投稿する</p>
                  <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-red-500 underline">
                    → {currentSiteName === '食べログ' ? '店舗ページを開く（「クチコミを書く」ボタンを押してください）' : '投稿画面を開く'}
                  </a>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="font-medium">投稿完了画面をスクリーンショット</p>
                  <p className="text-xs text-gray-500">「投稿しました」等の画面</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                <div><p className="font-medium">下のボタンからスクショを送信</p></div>
              </div>
            </div>
          </div>

          {/* ライブラリ選択（通常） */}
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} className="hidden" />
          {/* カメラ直撮り */}
          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />

          {!previewUrl ? (
            <div className="space-y-3">
              {/* カメラで撮る */}
              <button onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-blue-500 text-white rounded-2xl py-5 flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-md">
                <span className="text-3xl">📷</span>
                <div className="text-left">
                  <p className="font-bold text-base">カメラで今すぐ撮る</p>
                  <p className="text-xs text-blue-100">画面を見ながらスクショを撮影</p>
                </div>
              </button>
              {/* ライブラリから選ぶ */}
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white border-2 border-dashed border-blue-300 rounded-2xl py-5 flex items-center justify-center gap-3 hover:border-blue-400 transition-colors active:scale-95">
                <span className="text-3xl">🖼️</span>
                <div className="text-left">
                  <p className="font-bold text-base text-blue-600">ライブラリから選ぶ</p>
                  <p className="text-xs text-gray-400">撮影済みのスクリーンショット</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <img src={previewUrl} alt="preview" className="w-full max-h-80 object-contain bg-gray-100" />
              <div className="p-3 flex gap-2">
                <button onClick={() => { setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium">撮り直す</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="flex-[2] bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-lg text-sm font-bold">
                  {uploading ? '🤖 AI確認中...' : '✅ この画像で提出する'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
          <button onClick={handleReset} className="block w-full text-gray-400 text-xs mt-4 underline text-center">
            ↺ 最初からやり直す
          </button>
        </div>
      </div>
    )
  }

  // ===== ステージ4：結果表示 =====
  const bonusAmount = platform ? PLATFORM_INFO[platform].bonus : 100
  return (
    <div className={`min-h-screen ${
      verdict === 'approve' ? 'bg-gradient-to-br from-green-50 to-emerald-100'
      : verdict === 'reject'  ? 'bg-gradient-to-br from-red-50 to-orange-50'
      : 'bg-gradient-to-br from-amber-50 to-yellow-50'
    }`}>
      <div className="p-6">
        {verdict === 'approve' && (
          <>
            <div className="text-center py-6">
              <p className="text-6xl mb-3">🎉</p>
              <h1 className="text-2xl font-bold text-gray-800">口コミを確認できました！</h1>
              <p className="text-sm text-gray-600 mt-2">{selectedStaff?.name}さんの接客として記録しました</p>
            </div>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white text-center">
                <p className="text-xs font-semibold opacity-80">口コミ特典</p>
                <p className="text-2xl font-bold mt-1">
                  {platform === 'both'
                    ? '200円以下トッピング 2品無料'
                    : '200円以下トッピング 1品無料'}
                </p>
              </div>
              <div className="p-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-dashed border-green-300 rounded-2xl p-5 text-center">
                  <p className="text-xs text-gray-500">クーポンコード</p>
                  <p className="text-3xl font-bold text-green-600 tracking-wider my-2 select-all">{couponCode}</p>
                  <p className="text-xs text-gray-500">次回来店時にスタッフへ提示してください</p>
                </div>
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  ⚠️ 200円以下のトッピング{platform === 'both' ? '2品' : '1品'}に限り適用。他の割引との併用不可。
                </div>
                <div className="mt-3 bg-blue-50 rounded-xl p-3 text-xs text-blue-800">
                  📱 この画面をスクショして保存しておくと便利です
                </div>
              </div>
            </div>
          </>
        )}

        {verdict === 'review' && (
          <>
            <div className="text-center py-6">
              <p className="text-6xl mb-3">📩</p>
              <h1 className="text-xl font-bold text-gray-800">確認中です</h1>
              <p className="text-sm text-gray-600 mt-2">スタッフが確認後、<b>特典コードをお伝えします</b></p>
            </div>
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-center">
                <p className="font-bold text-green-800 mb-1">📱 この後の流れ</p>
                <p className="text-xs text-green-700">スタッフが内容を確認次第、<br /><b>特典コードをお伝えします</b>。<br />この画面を閉じて大丈夫です。</p>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">通常、当日中にご連絡いたします</p>
            </div>
          </>
        )}

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
                <p>投稿完了画面のスクリーンショットを撮影してください。</p>
              </div>
            </div>
          </>
        )}

        <div className="text-center mt-6 text-sm text-gray-500">またのご来店をお待ちしております 🙌</div>
        <div className="text-center mt-3">
          <button onClick={handleReset} className="text-xs text-gray-400 underline">↺ 最初からやり直す</button>
        </div>
      </div>
    </div>
  )
}
