'use client'

import { useState } from 'react'

type SalesRow = {
  date: string
  store_sales: number
  uber_sales: number
  rocketnow_sales: number
  menu_sales: number
  delivery_sales: number
  total_sales: number
  store_orders: number
  uber_orders: number | null
  rocketnow_orders: number | null
  menu_orders: number | null
  delivery_orders: number
  food_cost: number | null
  labor_cost: number | null
  ai_comment: string | null
}

const PLATFORMS = [
  { key: 'uber',      label: 'Uber Eats',  color: 'text-green-700',  bg: 'bg-green-50' },
  { key: 'rocketnow', label: 'ロケットなう', color: 'text-orange-700', bg: 'bg-orange-50' },
  { key: 'menu',      label: 'menu',        color: 'text-red-700',    bg: 'bg-red-50' },
]

export default function SalesClient({ initialSales }: { initialSales: SalesRow[] }) {
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)

  // 手動入力フォーム
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [storeSales, setStoreSales]         = useState('')
  const [storeOrders, setStoreOrders]       = useState('')
  const [uberSales, setUberSales]           = useState('')
  const [uberOrders, setUberOrders]         = useState('')
  const [rocketnowSales, setRocketnowSales] = useState('')
  const [rocketnowOrders, setRocketnowOrders] = useState('')
  const [menuSales, setMenuSales]           = useState('')
  const [menuOrders, setMenuOrders]         = useState('')
  const [foodCost, setFoodCost]             = useState('')
  const [saving, setSaving]                 = useState(false)

  const toast = (msg: string) => {
    setUploadMessage(msg)
    setTimeout(() => setUploadMessage(null), 3000)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/sales/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        toast(`✅ ${data.count}日分のデータを取り込みました`)
        setTimeout(() => window.location.reload(), 1000)
      } else {
        toast(`❌ ${data.error}`)
      }
    } catch (err) {
      toast(`❌ ${(err as Error).message}`)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleManualSave = async () => {
    setSaving(true)
    const res = await fetch('/api/sales/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        store_sales:      storeSales,
        store_orders:     storeOrders,
        uber_sales:       uberSales,
        uber_orders:      uberOrders,
        rocketnow_sales:  rocketnowSales,
        rocketnow_orders: rocketnowOrders,
        menu_sales:       menuSales,
        menu_orders:      menuOrders,
        food_cost:        foodCost || undefined,
      }),
    })
    if (res.ok) {
      toast(`✅ ${date}の売上を保存しました`)
      setShowManual(false)
      setTimeout(() => window.location.reload(), 800)
    } else {
      const data = await res.json()
      toast(`❌ ${data.error}`)
    }
    setSaving(false)
  }

  const generateReport = async (d: string) => {
    toast('🤖 AI日報生成中...')
    const res = await fetch('/api/reports/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: d }),
    })
    if (res.ok) {
      toast('✅ AI日報を生成しました')
      setTimeout(() => window.location.reload(), 800)
    }
  }

  // 月合計
  const monthTotal     = initialSales.reduce((s, r) => s + (r.total_sales ?? 0), 0)
  const monthStore     = initialSales.reduce((s, r) => s + (r.store_sales ?? 0), 0)
  const monthUber      = initialSales.reduce((s, r) => s + (r.uber_sales ?? 0), 0)
  const monthRocketnow = initialSales.reduce((s, r) => s + (r.rocketnow_sales ?? 0), 0)
  const monthMenu      = initialSales.reduce((s, r) => s + (r.menu_sales ?? 0), 0)
  const monthDelivery  = monthUber + monthRocketnow + monthMenu
  const monthFood      = initialSales.reduce((s, r) => s + (r.food_cost ?? 0), 0)
  const monthLabor     = initialSales.reduce((s, r) => s + (r.labor_cost ?? 0), 0)
  const flRatio        = monthTotal > 0 ? Math.round(((monthFood + monthLabor) / monthTotal) * 100) : null

  // デリバリー内訳の計算（媒体別比率）
  const deliveryRatio = (v: number) => monthDelivery > 0 ? Math.round((v / monthDelivery) * 100) : 0

  return (
    <>
      {uploadMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow z-50 text-sm whitespace-nowrap">
          {uploadMessage}
        </div>
      )}

      {/* 月次サマリー */}
      <div className="mx-4 mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">今月売上合計</p>
            <p className="text-2xl font-bold text-gray-900">¥{monthTotal.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">FL比率（目標≤55%）</p>
            <p className={`text-2xl font-bold ${flRatio === null ? 'text-gray-400' : flRatio <= 55 ? 'text-green-600' : 'text-red-600'}`}>
              {flRatio !== null ? `${flRatio}%` : 'データなし'}
            </p>
          </div>
        </div>

        {/* 売上内訳 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3">売上内訳（今月）</p>
          <div className="space-y-2">
            {/* 店内 */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🏠 店内</span>
              <span className="text-sm font-semibold text-gray-900">¥{monthStore.toLocaleString()}</span>
            </div>
            {/* デリバリー合計 */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🛵 デリバリー計</span>
              <span className="text-sm font-semibold text-gray-900">¥{monthDelivery.toLocaleString()}</span>
            </div>
            {/* 媒体別 */}
            <div className="ml-4 space-y-1">
              {monthUber > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-700">└ Uber Eats ({deliveryRatio(monthUber)}%)</span>
                  <span className="text-xs text-gray-600">¥{monthUber.toLocaleString()}</span>
                </div>
              )}
              {monthRocketnow > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-700">└ ロケットなう ({deliveryRatio(monthRocketnow)}%)</span>
                  <span className="text-xs text-gray-600">¥{monthRocketnow.toLocaleString()}</span>
                </div>
              )}
              {monthMenu > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-red-700">└ menu ({deliveryRatio(monthMenu)}%)</span>
                  <span className="text-xs text-gray-600">¥{monthMenu.toLocaleString()}</span>
                </div>
              )}
              {monthDelivery === 0 && (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* データ取込 */}
      <div className="mx-4 mt-4 bg-white rounded-xl p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">データ取込</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" disabled={uploading} />
            <div className={`cursor-pointer text-center py-3 rounded-lg font-semibold text-sm ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 text-white'}`}>
              {uploading ? '取込中...' : '📂 Excel取込'}
            </div>
          </label>
          <button onClick={() => setShowManual(!showManual)}
            className="py-3 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700">
            ✍️ 手動入力
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">AnyDeli / Uber Eats / ロケットなう の Excel・CSV に対応</p>
      </div>

      {/* 手動入力フォーム */}
      {showManual && (
        <div className="mx-4 mt-3 bg-white rounded-xl p-4 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-700">売上手動入力</p>

          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />

          {/* 店内 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">🏠 店内</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">売上</label>
                <input type="number" inputMode="numeric" placeholder="¥" value={storeSales} onChange={e => setStoreSales(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-400">注文数</label>
                <input type="number" inputMode="numeric" placeholder="件" value={storeOrders} onChange={e => setStoreOrders(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
            </div>
          </div>

          {/* Uber Eats */}
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-green-700 mb-2">🟢 Uber Eats</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">売上</label>
                <input type="number" inputMode="numeric" placeholder="¥" value={uberSales} onChange={e => setUberSales(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-400">注文数</label>
                <input type="number" inputMode="numeric" placeholder="件" value={uberOrders} onChange={e => setUberOrders(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
            </div>
          </div>

          {/* ロケットなう */}
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-orange-700 mb-2">🚀 ロケットなう</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">売上</label>
                <input type="number" inputMode="numeric" placeholder="¥" value={rocketnowSales} onChange={e => setRocketnowSales(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-400">注文数</label>
                <input type="number" inputMode="numeric" placeholder="件" value={rocketnowOrders} onChange={e => setRocketnowOrders(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
            </div>
          </div>

          {/* menu（将来用） */}
          <div className="bg-red-50 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-red-700">🔴 menu</p>
              <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">申請準備中</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400">売上</label>
                <input type="number" inputMode="numeric" placeholder="¥" value={menuSales} onChange={e => setMenuSales(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-400">注文数</label>
                <input type="number" inputMode="numeric" placeholder="件" value={menuOrders} onChange={e => setMenuOrders(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
            </div>
          </div>

          {/* 食材費 */}
          <div>
            <label className="text-xs text-gray-500">食材費（任意）</label>
            <input type="number" inputMode="numeric" placeholder="¥" value={foodCost} onChange={e => setFoodCost(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
          </div>

          <button onClick={handleManualSave} disabled={saving}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      )}

      {/* 日別データ一覧 */}
      <div className="mx-4 mt-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-gray-500">今月の日別データ</h2>
          <span className="text-xs text-gray-400">{initialSales.length}日分</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {initialSales.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">データがありません</p>
          ) : initialSales.map(row => {
            const uber      = row.uber_sales ?? 0
            const rocketnow = row.rocketnow_sales ?? 0
            const menu      = row.menu_sales ?? 0
            const hasDetail = uber > 0 || rocketnow > 0 || menu > 0
            return (
              <div key={row.date} className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {row.date.slice(5).replace('-', '/')}
                    </p>
                    <p className="text-xl font-bold text-gray-800">
                      ¥{row.total_sales.toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => generateReport(row.date)}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded">
                    🤖 AI日報
                  </button>
                </div>

                {/* 媒体別内訳 */}
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    🏠 ¥{row.store_sales.toLocaleString()}（{row.store_orders}件）
                  </span>
                  {uber > 0 && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                      Uber ¥{uber.toLocaleString()}（{row.uber_orders ?? 0}件）
                    </span>
                  )}
                  {rocketnow > 0 && (
                    <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                      🚀 ¥{rocketnow.toLocaleString()}（{row.rocketnow_orders ?? 0}件）
                    </span>
                  )}
                  {menu > 0 && (
                    <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                      menu ¥{menu.toLocaleString()}（{row.menu_orders ?? 0}件）
                    </span>
                  )}
                  {!hasDetail && row.delivery_sales > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      🛵 ¥{row.delivery_sales.toLocaleString()}（{row.delivery_orders}件）
                    </span>
                  )}
                </div>

                {row.ai_comment && (
                  <div className="p-2 bg-blue-50 rounded-lg text-xs text-blue-800 whitespace-pre-wrap mt-1">
                    {row.ai_comment}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
