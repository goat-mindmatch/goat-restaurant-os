'use client'

import { useState } from 'react'

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || ''
// Google Maps 口コミ投稿URL（Place ID があれば直接口コミフォームへ）
const GOOGLE_REVIEW_URL = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
  : 'https://www.google.com/maps/search/人類みなまぜそば'

export default function ReviewClient({
  staffList, customerLineUserId,
}: {
  staffList: { id: string; name: string }[]
  customerLineUserId: string | null
}) {
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const handleStaffPick = (staff: { id: string; name: string }) => {
    setSelectedStaff(staff)
  }

  const handleGoToReview = async () => {
    if (!selectedStaff) return
    setRedirecting(true)

    // スタッフ指名を記録
    try {
      await fetch('/api/reviews/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
          customer_line_user_id: customerLineUserId,
        }),
      })
    } catch (e) {
      console.error(e)
    }

    setSubmitted(true)
    setRedirecting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-lg">
          <div className="text-center mb-6">
            <p className="text-5xl mb-2">⭐</p>
            <h2 className="text-xl font-bold text-gray-800 mb-2">ありがとうございます！</h2>
            <p className="text-sm text-gray-600">
              {selectedStaff?.name}さんの接客を記録しました
            </p>
          </div>

          {/* ステップ案内 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm">
            <p className="font-bold text-amber-900 mb-2">📝 次のステップ</p>
            <div className="space-y-2 text-amber-800">
              <div className="flex gap-2">
                <span className="font-bold">①</span>
                <span>下のボタンから Google で口コミを書く</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold">②</span>
                <span>書き終わったら <b>LINEに戻って「書きました」</b>と送信</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold">③</span>
                <span>🎁 次回来店時のお礼をお届けします</span>
              </div>
            </div>
          </div>

          <a href={GOOGLE_REVIEW_URL}
            className="block w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-center text-base shadow-lg">
            ⭐ Googleで口コミを書く
          </a>

          <p className="text-xs text-gray-500 text-center mt-3">
            {redirecting ? '🔗 自動で開きます...' : ''}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-red-50">
      {/* ヘッダー */}
      <div className="p-6 text-center">
        <p className="text-5xl mb-2">🍜</p>
        <h1 className="text-2xl font-bold text-gray-800">ご来店ありがとうございました</h1>
        <p className="text-sm text-gray-600 mt-2">
          本日の接客はいかがでしたか？<br />
          担当したスタッフを選んでください
        </p>
      </div>

      {/* スタッフ選択 */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">本日の担当スタッフ</p>
          <div className="grid grid-cols-2 gap-2">
            {staffList.map(s => (
              <button
                key={s.id}
                onClick={() => handleStaffPick(s)}
                className={`py-4 rounded-xl font-bold text-base transition-all
                  ${selectedStaff?.id === s.id
                    ? 'bg-orange-500 text-white ring-4 ring-orange-200'
                    : 'bg-gray-50 text-gray-700 border border-gray-200'}`}
              >
                {s.name}
                {selectedStaff?.id === s.id && <span className="block text-xs mt-1">✓ 選択中</span>}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSelectedStaff({ id: 'nominee', name: '特に指名なし' })}
            className={`w-full mt-2 py-3 rounded-xl text-sm
              ${selectedStaff?.id === 'nominee'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-50 text-gray-500 border'}`}
          >
            わからない / 指名なし
          </button>
        </div>

        {/* 送信ボタン */}
        <div className="mt-6">
          <button
            onClick={handleGoToReview}
            disabled={!selectedStaff}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-lg shadow-lg transition-all"
          >
            ⭐ Googleで口コミを書く
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            タップするとGoogleマップに移動します。<br />
            皆様の声が大きな励みになります！
          </p>
        </div>
      </div>
    </div>
  )
}
