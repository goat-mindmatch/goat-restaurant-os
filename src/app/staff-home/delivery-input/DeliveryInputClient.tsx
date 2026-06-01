'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Current = {
  uber_sales?: number
  uber_orders?: number
  rocketnow_sales?: number
  rocketnow_orders?: number
  anydeli_sales?: number
  total_sales?: number
}

const yen = (n: number | undefined) => `¥${(n ?? 0).toLocaleString()}`

function jstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().split('T')[0]
}
function jstYesterday(): string {
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

// 各サービスの確認先（モバイルブラウザで開く）
const UBER_URL = 'https://merchants.ubereats.com/'
const ROCKET_URL = 'https://store.rocketnow.co.jp/merchant/'

export default function DeliveryInputClient() {
  const [date, setDate] = useState(jstToday())
  const [current, setCurrent] = useState<Current>({})
  const [loading, setLoading] = useState(true)

  const [uberSales, setUberSales] = useState('')
  const [uberOrders, setUberOrders] = useState('')
  const [rocketSales, setRocketSales] = useState('')
  const [rocketOrders, setRocketOrders] = useState('')

  const [savingUber, setSavingUber] = useState(false)
  const [savingRocket, setSavingRocket] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/manual-delivery?date=${date}`, { cache: 'no-store' })
      const j = await res.json()
      setCurrent(j.current ?? {})
      // 既存値を入力欄の初期値に（確認して上書きできる）
      setUberSales(j.current?.uber_sales ? String(j.current.uber_sales) : '')
      setUberOrders(j.current?.uber_orders ? String(j.current.uber_orders) : '')
      setRocketSales(j.current?.rocketnow_sales ? String(j.current.rocketnow_sales) : '')
      setRocketOrders(j.current?.rocketnow_orders ? String(j.current.rocketnow_orders) : '')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const saveUber = async () => {
    if (uberSales === '') { alert('Uberの売上金額を入力してください'); return }
    setSavingUber(true)
    try {
      const res = await fetch('/api/sales/manual-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          uber_sales: Number(uberSales),
          uber_orders: uberOrders === '' ? 0 : Number(uberOrders),
        }),
      })
      const j = await res.json()
      if (!res.ok) { alert(`保存失敗: ${j.error ?? res.status}`); return }
      setCurrent(j.saved ?? current)
      flash('✅ Uber売上を保存しました')
    } finally {
      setSavingUber(false)
    }
  }

  const saveRocket = async () => {
    if (rocketSales === '') { alert('RocketNowの売上金額を入力してください'); return }
    setSavingRocket(true)
    try {
      const res = await fetch('/api/sales/manual-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          rocketnow_sales: Number(rocketSales),
          rocketnow_orders: rocketOrders === '' ? 0 : Number(rocketOrders),
        }),
      })
      const j = await res.json()
      if (!res.ok) { alert(`保存失敗: ${j.error ?? res.status}`); return }
      setCurrent(j.saved ?? current)
      flash('✅ RocketNow売上を保存しました')
    } finally {
      setSavingRocket(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-32">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/staff-home" className="text-gray-400">← ホーム</Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">🛵 デリバリー売上入力</h1>
          <p className="text-xs text-gray-500">アプリの数字を見て入力するだけ</p>
        </div>
      </div>

      {/* 日付選択 */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">📅 対象日</p>
        <div className="flex gap-2">
          <button
            onClick={() => setDate(jstToday())}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${date === jstToday() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >今日</button>
          <button
            onClick={() => setDate(jstYesterday())}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${date === jstYesterday() ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >昨日</button>
          <input
            type="date"
            value={date}
            max={jstToday()}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 text-sm"
          />
        </div>
      </div>

      {/* 現在の合計（確認用） */}
      <div className="mx-4 mt-4 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-sm p-4 text-white">
        <p className="text-xs opacity-80">この日の総売上（自動計算）</p>
        <p className="text-3xl font-bold mt-1">{yen(current.total_sales)}</p>
        <div className="flex gap-4 mt-2 text-xs opacity-90">
          <span>店頭/エニデリ {yen(current.anydeli_sales)}</span>
          <span>Uber {yen(current.uber_sales)}</span>
          <span>Rocket {yen(current.rocketnow_sales)}</span>
        </div>
      </div>

      {loading && <p className="text-center text-gray-400 py-6 text-sm">読み込み中...</p>}

      {/* Uber 入力カード */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-black px-4 py-3 flex items-center justify-between">
          <span className="text-white font-bold">Uber Eats</span>
          <a
            href={UBER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg"
          >📲 アプリ/管理画面を開く</a>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            「Uber Eats Manager」で本日の売上を確認 → 下に入力してください
          </p>
          <label className="block">
            <span className="text-xs text-gray-500">売上金額（円）</span>
            <input
              type="number" inputMode="numeric" placeholder="例: 35000"
              value={uberSales}
              onChange={e => setUberSales(e.target.value)}
              className="w-full mt-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:border-blue-500 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">注文件数（任意）</span>
            <input
              type="number" inputMode="numeric" placeholder="例: 12"
              value={uberOrders}
              onChange={e => setUberOrders(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none"
            />
          </label>
          <button
            onClick={saveUber}
            disabled={savingUber}
            className="w-full bg-black text-white font-bold py-3.5 rounded-xl text-base disabled:opacity-50"
          >
            {savingUber ? '保存中...' : '💾 Uber売上を保存'}
          </button>
        </div>
      </div>

      {/* RocketNow 入力カード */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
          <span className="text-white font-bold">RocketNow（ロケットなう）</span>
          <a
            href={ROCKET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg"
          >📲 管理画面を開く</a>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            RocketNow加盟店管理で本日の売上を確認 → 下に入力してください
          </p>
          <label className="block">
            <span className="text-xs text-gray-500">売上金額（円）</span>
            <input
              type="number" inputMode="numeric" placeholder="例: 4000"
              value={rocketSales}
              onChange={e => setRocketSales(e.target.value)}
              className="w-full mt-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:border-red-500 outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">注文件数（任意）</span>
            <input
              type="number" inputMode="numeric" placeholder="例: 2"
              value={rocketOrders}
              onChange={e => setRocketOrders(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 focus:border-red-500 outline-none"
            />
          </label>
          <button
            onClick={saveRocket}
            disabled={savingRocket}
            className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl text-base disabled:opacity-50"
          >
            {savingRocket ? '保存中...' : '💾 RocketNow売上を保存'}
          </button>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-4 px-6">
        ※ 店頭・エニデリは自動取込のため入力不要です。<br />
        Uber/RocketNowのみ手動入力をお願いします。
      </p>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  )
}
