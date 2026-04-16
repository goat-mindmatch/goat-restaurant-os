'use client'

import { useState } from 'react'

type SalesRow = {
  date: string
  store_sales: number
  delivery_sales: number
  total_sales: number
  store_orders: number
  delivery_orders: number
  food_cost: number | null
  labor_cost: number | null
  ai_comment: string | null
}

export default function SalesClient({ initialSales }: { initialSales: SalesRow[] }) {
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)

  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualStore, setManualStore] = useState('')
  const [manualDelivery, setManualDelivery] = useState('')
  const [manualStoreOrders, setManualStoreOrders] = useState('')
  const [manualDeliveryOrders, setManualDeliveryOrders] = useState('')
  const [manualFoodCost, setManualFoodCost] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMessage(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/sales/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setUploadMessage(`✅ ${data.count}日分のデータを取り込みました`)
        setTimeout(() => window.location.reload(), 1000)
      } else {
        setUploadMessage(`❌ ${data.error}`)
      }
    } catch (err) {
      setUploadMessage(`❌ ${(err as Error).message}`)
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleManualSave = async () => {
    const res = await fetch('/api/sales/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: manualDate,
        store_sales: manualStore,
        delivery_sales: manualDelivery,
        store_orders: manualStoreOrders,
        delivery_orders: manualDeliveryOrders,
        food_cost: manualFoodCost || undefined,
      }),
    })
    if (res.ok) {
      setUploadMessage(`✅ ${manualDate}の売上を保存しました`)
      setShowManual(false)
      setTimeout(() => window.location.reload(), 800)
    } else {
      const data = await res.json()
      setUploadMessage(`❌ ${data.error}`)
    }
  }

  const generateReport = async (date: string) => {
    setUploadMessage('🤖 AI日報生成中...')
    const res = await fetch('/api/reports/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    if (res.ok) {
      setUploadMessage('✅ AI日報を生成しました')
      setTimeout(() => window.location.reload(), 800)
    }
  }

  // 月合計
  const monthTotal = initialSales.reduce((s, r) => s + (r.total_sales ?? 0), 0)
  const monthStore = initialSales.reduce((s, r) => s + (r.store_sales ?? 0), 0)
  const monthDelivery = initialSales.reduce((s, r) => s + (r.delivery_sales ?? 0), 0)
  const monthFood = initialSales.reduce((s, r) => s + (r.food_cost ?? 0), 0)
  const monthLabor = initialSales.reduce((s, r) => s + (r.labor_cost ?? 0), 0)
  const flRatio = monthTotal > 0 ? Math.round(((monthFood + monthLabor) / monthTotal) * 100) : null

  return (
    <>
      {uploadMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow z-50 text-sm">
          {uploadMessage}
        </div>
      )}

      {/* 月次サマリー */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400">今月売上</p>
          <p className="text-2xl font-bold text-gray-900">¥{monthTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            店内¥{monthStore.toLocaleString()} / 配達¥{monthDelivery.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400">FL比率（目標≤55%）</p>
          <p className={`text-2xl font-bold ${flRatio === null ? 'text-gray-400' : flRatio <= 55 ? 'text-green-600' : 'text-red-600'}`}>
            {flRatio !== null ? `${flRatio}%` : 'データなし'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            F ¥{monthFood.toLocaleString()} / L ¥{monthLabor.toLocaleString()}
          </p>
        </div>
      </div>

      {/* アップロード・手動入力 */}
      <div className="mx-4 mt-4 bg-white rounded-xl p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">データ取込</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" disabled={uploading} />
            <div className={`cursor-pointer text-center py-3 rounded-lg font-semibold text-sm ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
              {uploading ? '取込中...' : '📂 Excel取込'}
            </div>
          </label>
          <button onClick={() => setShowManual(!showManual)}
            className="py-3 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">
            ✍️ 手動入力
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          AnyDeli / Uber Eats の Excel / CSV に対応
        </p>
      </div>

      {/* 手動入力フォーム */}
      {showManual && (
        <div className="mx-4 mt-3 bg-white rounded-xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700">手動入力</p>
          <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">店内売上</label>
              <input type="number" inputMode="numeric" placeholder="¥" value={manualStore} onChange={e => setManualStore(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">デリバリー売上</label>
              <input type="number" inputMode="numeric" placeholder="¥" value={manualDelivery} onChange={e => setManualDelivery(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">店内注文数</label>
              <input type="number" inputMode="numeric" placeholder="件" value={manualStoreOrders} onChange={e => setManualStoreOrders(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">デリバリー件数</label>
              <input type="number" inputMode="numeric" placeholder="件" value={manualDeliveryOrders} onChange={e => setManualDeliveryOrders(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">食材費（任意）</label>
              <input type="number" inputMode="numeric" placeholder="¥" value={manualFoodCost} onChange={e => setManualFoodCost(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={handleManualSave}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg text-sm">保存</button>
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
          ) : initialSales.map(row => (
            <div key={row.date} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {row.date.slice(5).replace('-', '/')}
                  </p>
                  <p className="text-lg font-bold text-gray-800">¥{row.total_sales.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    店内{row.store_orders}件・配達{row.delivery_orders}件
                  </p>
                </div>
                <button onClick={() => generateReport(row.date)}
                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100">
                  🤖 AI日報
                </button>
              </div>
              {row.ai_comment && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800 whitespace-pre-wrap">
                  {row.ai_comment}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
