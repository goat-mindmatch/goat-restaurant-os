'use client'

import { useState } from 'react'

type Existing = {
  store_sales: number | null
  uber_sales: number | null
  rocketnow_sales: number | null
  menu_sales: number | null
  lunch_sales: number | null
  dinner_sales: number | null
  food_cost: number | null
} | null

export default function SalesFormClient({
  lineUserId,
  staffName,
  today,
  existing,
}: {
  lineUserId: string
  staffName: string
  today: string
  existing: Existing
}) {
  const [storeSales,     setStoreSales]     = useState(String(existing?.store_sales     ?? ''))
  const [uberSales,      setUberSales]      = useState(String(existing?.uber_sales      ?? ''))
  const [rocketnowSales, setRocketnowSales] = useState(String(existing?.rocketnow_sales ?? ''))
  const [menuSales,      setMenuSales]      = useState(String(existing?.menu_sales      ?? ''))
  const [lunchSales,     setLunchSales]     = useState(String(existing?.lunch_sales     ?? ''))
  const [dinnerSales,    setDinnerSales]    = useState(String(existing?.dinner_sales    ?? ''))
  const [foodCost,       setFoodCost]       = useState(String(existing?.food_cost       ?? ''))
  const [cashSales,      setCashSales]      = useState('')
  const [cardSales,      setCardSales]      = useState('')
  const [qrSales,        setQrSales]        = useState('')
  const [paymentOpen,    setPaymentOpen]    = useState(false)

  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [errMsg,   setErrMsg]   = useState<string | null>(null)

  const n = (v: string) => Number(v.replace(/[,，¥￥円]/g, '')) || 0

  const totalDelivery = n(uberSales) + n(rocketnowSales) + n(menuSales)
  const total         = n(storeSales) + totalDelivery

  const dateLabel = today.slice(5).replace('-', '/')

  const handleSubmit = async () => {
    setSaving(true)
    setErrMsg(null)
    try {
      const res = await fetch('/api/sales/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date:             today,
          store_sales:      n(storeSales),
          uber_sales:       n(uberSales),
          rocketnow_sales:  n(rocketnowSales),
          menu_sales:       n(menuSales),
          lunch_sales:      lunchSales  ? n(lunchSales)  : undefined,
          dinner_sales:     dinnerSales ? n(dinnerSales) : undefined,
          food_cost:        foodCost    ? n(foodCost)    : undefined,
          cash_sales:       cashSales   ? n(cashSales)   : undefined,
          card_sales:       cardSales   ? n(cardSales)   : undefined,
          qr_sales:         qrSales     ? n(qrSales)     : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? '保存に失敗しました')
      }
      setDone(true)
    } catch (e) {
      setErrMsg((e as Error).message)
    }
    setSaving(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-xl font-bold text-gray-900 mb-2">{dateLabel} 売上を保存しました</p>
          <p className="text-2xl font-bold text-orange-500 mb-1">¥{total.toLocaleString()}</p>
          <p className="text-sm text-gray-400 mb-6">
            店内 ¥{n(storeSales).toLocaleString()} ／ デリバリー ¥{totalDelivery.toLocaleString()}
          </p>
          <a
            href={`https://goat-restaurant-os.vercel.app/dashboard?uid=${lineUserId}`}
            className="block w-full py-3 bg-orange-500 text-white rounded-xl font-bold text-sm"
          >
            ダッシュボードを開く
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-bold text-gray-900">売上入力</h1>
            <p className="text-xs text-gray-400">{dateLabel}（{staffName}）</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">合計</p>
            <p className="text-xl font-bold text-orange-500">¥{total.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* 店内売上 */}
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">🏪 店内売上</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">店内合計（円）</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold mt-1"
                placeholder="0"
                value={storeSales}
                onChange={e => setStoreSales(e.target.value)}
              />
            </div>
            {/* 決済方法内訳 */}
            <div>
              <button
                type="button"
                onClick={() => setPaymentOpen(v => !v)}
                className="w-full flex items-center justify-between text-xs text-gray-500 font-semibold py-1"
              >
                <span>決済方法内訳（任意）</span>
                <span>{paymentOpen ? '▲' : '▼'}</span>
              </button>
              {paymentOpen && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-gray-400">現金＋カード＋QR = 店内売上の合計になるよう入力してください（任意）</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-400">現金（円）</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm mt-0.5"
                        placeholder="0"
                        value={cashSales}
                        onChange={e => setCashSales(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">カード（円）</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm mt-0.5"
                        placeholder="0"
                        value={cardSales}
                        onChange={e => setCardSales(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">QR/PayPay</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm mt-0.5"
                        placeholder="0"
                        value={qrSales}
                        onChange={e => setQrSales(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">うちランチ（任意）</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1"
                  placeholder="0"
                  value={lunchSales}
                  onChange={e => setLunchSales(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">うちディナー（任意）</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1"
                  placeholder="0"
                  value={dinnerSales}
                  onChange={e => setDinnerSales(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* デリバリー */}
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">🛵 デリバリー売上</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Uber Eats（円）</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold mt-1"
                placeholder="0"
                value={uberSales}
                onChange={e => setUberSales(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">ロケットなう（円）</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold mt-1"
                placeholder="0"
                value={rocketnowSales}
                onChange={e => setRocketnowSales(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">menu（円）</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold mt-1"
                placeholder="0"
                value={menuSales}
                onChange={e => setMenuSales(e.target.value)}
              />
            </div>
            <div className="bg-orange-50 rounded-xl px-4 py-2 flex justify-between">
              <span className="text-sm text-gray-500">デリバリー小計</span>
              <span className="text-sm font-bold text-orange-600">¥{totalDelivery.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 食材費 */}
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">🥩 食材費（任意）</p>
          <div>
            <label className="text-xs text-gray-400">本日の食材費（円）</label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold mt-1"
              placeholder="0"
              value={foodCost}
              onChange={e => setFoodCost(e.target.value)}
            />
          </div>
        </div>

        {/* エラー */}
        {errMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            ❌ {errMsg}
          </div>
        )}

        {/* 合計確認＆保存 */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">本日の合計売上</span>
            <span className="text-2xl font-bold text-orange-500">¥{total.toLocaleString()}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || total === 0}
            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold text-base shadow disabled:opacity-40"
          >
            {saving ? '保存中...' : '💾 売上を保存する'}
          </button>
          {total === 0 && (
            <p className="text-xs text-center text-gray-400 mt-2">売上を入力してください</p>
          )}
        </div>
      </div>
    </div>
  )
}
