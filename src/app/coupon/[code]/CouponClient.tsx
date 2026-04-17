'use client'

import { useState } from 'react'

type Props = {
  reviewId: string
  couponCode: string
  staffName: string
  verifiedAt: string | null
  usedAt: string | null
  clickedAt: string
}

export default function CouponClient({ reviewId, couponCode, staffName, verifiedAt, usedAt: initialUsedAt, clickedAt }: Props) {
  const [usedAt, setUsedAt] = useState(initialUsedAt)
  const [processing, setProcessing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const expiry = new Date(new Date(clickedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
  const isExpired = Date.now() > expiry.getTime()
  const expiryStr = `${expiry.getFullYear()}/${String(expiry.getMonth() + 1).padStart(2, '0')}/${String(expiry.getDate()).padStart(2, '0')}`

  const handleUse = async () => {
    if (!confirm('このクーポンを使用済みにしますか？この操作は取り消せません。')) return
    setProcessing(true)
    try {
      const res = await fetch('/api/reviews/use-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: reviewId }),
      })
      if (res.ok) {
        setUsedAt(new Date().toISOString())
        setConfirmed(true)
      }
    } catch {}
    setProcessing(false)
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ===== 使用済み =====
  if (usedAt) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full overflow-hidden">
          <div className="bg-gray-400 p-5 text-center text-white">
            <p className="text-sm opacity-80">🍜 人類みなまぜそば</p>
            <p className="text-xl font-bold mt-1">使用済み</p>
          </div>
          <div className="p-6 text-center">
            <p className="text-5xl mb-3 opacity-50">✓</p>
            <p className="text-gray-500 text-sm">このクーポンは使用済みです</p>
            <p className="text-xs text-gray-400 mt-2">使用日: {fmtTime(usedAt)}</p>
            <p className="text-xs text-gray-400">コード: {couponCode}</p>
            {confirmed && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                ✅ 適用完了！ありがとうございました
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ===== 未検証 =====
  if (!verifiedAt) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full overflow-hidden">
          <div className="bg-amber-500 p-5 text-center text-white">
            <p className="text-sm opacity-80">🍜 人類みなまぜそば</p>
            <p className="text-xl font-bold mt-1">確認待ち</p>
          </div>
          <div className="p-6 text-center">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-gray-700">このクーポンはまだ確認中です</p>
            <p className="text-xs text-gray-400 mt-2">スタッフの承認後にご利用いただけます</p>
          </div>
        </div>
      </div>
    )
  }

  // ===== 有効期限切れ =====
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full overflow-hidden">
          <div className="bg-gray-500 p-5 text-center text-white">
            <p className="text-sm opacity-80">🍜 人類みなまぜそば</p>
            <p className="text-xl font-bold mt-1">有効期限切れ</p>
          </div>
          <div className="p-6 text-center">
            <p className="text-gray-500">このクーポンは有効期限が過ぎています</p>
            <p className="text-xs text-gray-400 mt-2">期限: {expiryStr}</p>
          </div>
        </div>
      </div>
    )
  }

  // ===== 有効なクーポン =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 p-5 text-center text-white">
          <p className="text-sm opacity-80">🍜 人類みなまぜそば</p>
          <p className="text-2xl font-bold mt-1">口コミ特典</p>
        </div>

        {/* クーポン内容 */}
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-4xl font-bold text-red-600 mb-1">¥100 OFF</p>
            <p className="text-sm text-gray-600">次回ご来店時にご利用いただけます</p>
          </div>

          {/* 詳細 */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">コード</span>
              <span className="font-bold text-red-600">{couponCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">対象スタッフ</span>
              <span className="text-gray-800">{staffName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">有効期限</span>
              <span className="text-gray-800">{expiryStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ステータス</span>
              <span className="text-green-600 font-bold">✅ 有効</span>
            </div>
          </div>

          {/* 使用ボタン */}
          <button onClick={handleUse} disabled={processing}
            className="w-full mt-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition-all">
            {processing ? '処理中...' : '🎫 このクーポンを使う'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            お会計時にスタッフへこの画面をお見せください<br />
            スタッフが上のボタンを押して適用します
          </p>
        </div>
      </div>
    </div>
  )
}
