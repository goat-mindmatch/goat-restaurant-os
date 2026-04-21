'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  anydeli_sales?: number
  anydeli_cash_sales?: number
  anydeli_online_sales?: number
  anydeli_synced_at?: string
}

export default function SalesClient({ initialSales }: { initialSales: SalesRow[] }) {
  const router = useRouter()
  const [sales, setSales]             = useState<SalesRow[]>(initialSales)
  const [message, setMessage]         = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'ok' | 'err' | 'info'>('ok')
  const [showManual, setShowManual]   = useState(false)
  const [manualStep, setManualStep]   = useState(1)
  const [saving, setSaving]           = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 手動入力フォーム
  const [date, setDate]                     = useState(new Date().toISOString().split('T')[0])
  const [storeSales, setStoreSales]         = useState('')
  const [storeOrders, setStoreOrders]       = useState('')
  const [lunchSales, setLunchSales]         = useState('')
  const [lunchOrders, setLunchOrders]       = useState('')
  const [dinnerSales, setDinnerSales]       = useState('')
  const [dinnerOrders, setDinnerOrders]     = useState('')
  const [uberSales, setUberSales]           = useState('')
  const [uberOrders, setUberOrders]         = useState('')
  const [rocketnowSales, setRocketnowSales] = useState('')
  const [rocketnowOrders, setRocketnowOrders] = useState('')
  const [menuSales, setMenuSales]           = useState('')
  const [menuOrders, setMenuOrders]         = useState('')
  const [foodCost, setFoodCost]             = useState('')

  const toast = useCallback((msg: string, type: 'ok' | 'err' | 'info' = 'ok') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(null), 4000)
  }, [])

  // ページデータ更新（サーバーから再取得）
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res  = await fetch('/api/sales/list')
      if (res.ok) {
        const data = await res.json()
        setSales(data.sales ?? [])
        toast('✅ データを更新しました')
      } else {
        // fallback: ページリロード
        router.refresh()
      }
    } catch {
      router.refresh()
    } finally {
      setRefreshing(false)
    }
  }, [router, toast])

  // AnyDeli 今すぐ同期
  const handleSyncNow = useCallback(async () => {
    setSyncing(true)
    toast('⏳ 同期リクエストを送信中...', 'info')
    try {
      const res  = await fetch('/api/admin/sync-trigger', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '送信失敗')

      toast('📡 同期リクエスト送信済み。最大60秒で自動取込されます', 'info')

      // 完了まで10秒ごとにポーリング（最大90秒）
      let count = 0
      const requestedAt = json.requested_at
      pollRef.current = setInterval(async () => {
        count++
        try {
          const statusRes  = await fetch('/api/admin/sync-status')
          const statusJson = await statusRes.json()
          if (statusJson.completed && statusJson.completed_at >= requestedAt) {
            clearInterval(pollRef.current!)
            setSyncing(false)
            toast('✅ 同期完了！データを更新します')
            setTimeout(() => handleRefresh(), 1000)
          } else if (count >= 9) {
            clearInterval(pollRef.current!)
            setSyncing(false)
            toast('⚠️ タイムアウト。Macが起動しているか確認してください', 'err')
          }
        } catch {
          if (count >= 9) {
            clearInterval(pollRef.current!)
            setSyncing(false)
          }
        }
      }, 10000)
    } catch (e) {
      toast(`❌ ${(e as Error).message}`, 'err')
      setSyncing(false)
    }
  }, [toast, handleRefresh])

  // コンポーネントアンマウント時にポーリング停止
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // AI日報生成
  const generateReport = useCallback(async (d: string) => {
    toast('🤖 AI日報生成中...', 'info')
    const res = await fetch('/api/reports/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: d }),
    })
    if (res.ok) {
      toast('✅ AI日報を生成しました')
      setTimeout(() => router.refresh(), 800)
    }
  }, [toast, router])

  // 売上データ削除
  const handleDelete = useCallback(async (targetDate: string) => {
    try {
      const res  = await fetch(`/api/sales/delete?date=${targetDate}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '削除失敗')
      setSales(prev => prev.filter(r => r.date !== targetDate))
      toast(`🗑️ ${targetDate} のデータを削除しました`)
    } catch (e) {
      toast(`❌ ${(e as Error).message}`, 'err')
    } finally {
      setDeleteTarget(null)
    }
  }, [toast])

  // 手動保存
  const handleManualSave = useCallback(async () => {
    setSaving(true)
    const res = await fetch('/api/sales/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        store_sales:      storeSales,
        store_orders:     storeOrders,
        lunch_sales:      lunchSales  || undefined,
        lunch_orders:     lunchOrders || undefined,
        dinner_sales:     dinnerSales  || undefined,
        dinner_orders:    dinnerOrders || undefined,
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
      setTimeout(() => router.refresh(), 800)
    } else {
      const data = await res.json()
      toast(`❌ ${data.error}`, 'err')
    }
    setSaving(false)
  }, [date, storeSales, storeOrders, lunchSales, lunchOrders, dinnerSales, dinnerOrders, uberSales, uberOrders, rocketnowSales, rocketnowOrders, menuSales, menuOrders, foodCost, toast, router])

  // 月合計
  const monthTotal     = sales.reduce((s, r) => s + (r.total_sales ?? 0), 0)
  const monthStore     = sales.reduce((s, r) => s + (r.store_sales ?? 0), 0)
  const monthUber      = sales.reduce((s, r) => s + (r.uber_sales ?? 0), 0)
  const monthRocketnow = sales.reduce((s, r) => s + (r.rocketnow_sales ?? 0), 0)
  const monthMenu      = sales.reduce((s, r) => s + (r.menu_sales ?? 0), 0)
  const monthDelivery  = monthUber + monthRocketnow + monthMenu
  const monthFood      = sales.reduce((s, r) => s + (r.food_cost ?? 0), 0)
  const monthLabor     = sales.reduce((s, r) => s + (r.labor_cost ?? 0), 0)
  const flRatio        = monthTotal > 0 ? Math.round(((monthFood + monthLabor) / monthTotal) * 100) : null

  const deliveryRatio = (v: number) => monthDelivery > 0 ? Math.round((v / monthDelivery) * 100) : 0

  const msgBg = messageType === 'err' ? 'bg-red-600' : messageType === 'info' ? 'bg-blue-600' : 'bg-gray-900'

  return (
    <>
      {message && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 ${msgBg} text-white px-4 py-2 rounded-lg shadow z-50 text-sm whitespace-nowrap`}>
          {message}
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <p className="text-lg font-bold text-gray-800 mb-2">データを削除しますか？</p>
            <p className="text-sm text-gray-500 mb-4">
              {deleteTarget} のすべての売上データが削除されます。この操作は元に戻せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* データ操作パネル */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">データ操作</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || syncing}
            className="flex items-center justify-center gap-1.5 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
            {refreshing ? '更新中...' : 'データ更新'}
          </button>
          <button
            onClick={handleSyncNow}
            disabled={syncing || refreshing}
            className="flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
          >
            <span className={syncing ? 'animate-pulse' : ''}>⚡</span>
            {syncing ? '同期中...' : 'AnyDeli 今すぐ同期'}
          </button>
        </div>
        {syncing && (
          <p className="text-xs text-blue-500 text-center mt-2">
            Macのスクレイパーを起動中です。最大60秒お待ちください...
          </p>
        )}
        <div className="mt-3 border-t pt-3">
          <button
            onClick={() => { setShowManual(!showManual); setManualStep(1) }}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gray-50 text-gray-600"
          >
            ✍️ 手動入力
          </button>
        </div>
      </div>

      {/* 手動入力フォーム */}
      {showManual && (
        <div className="mx-4 mt-3 bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 flex flex-col items-center gap-0.5">
                <div className={`w-full h-1.5 rounded-full ${s <= manualStep ? 'bg-blue-500' : 'bg-gray-200'}`} />
                <p className={`text-[10px] ${s === manualStep ? 'text-blue-600 font-bold' : 'text-gray-300'}`}>
                  {s === 1 ? '日付' : s === 2 ? '店内' : s === 3 ? '配達' : 'コスト'}
                </p>
              </div>
            ))}
          </div>

          {manualStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-800">📅 対象日を選択</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-center font-bold" />
              <button onClick={() => setManualStep(2)} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl">
                次へ →
              </button>
            </div>
          )}

          {manualStep === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-800">🏠 店内売上（{date}）</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">売上合計</label>
                  <input type="number" inputMode="numeric" placeholder="¥" value={storeSales}
                    onChange={e => setStoreSales(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">注文数</label>
                  <input type="number" inputMode="numeric" placeholder="件" value={storeOrders}
                    onChange={e => setStoreOrders(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm mt-0.5" />
                </div>
              </div>
              <p className="text-xs text-gray-400">内訳（任意）</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-yellow-700 mb-1.5">☀️ 昼</p>
                  <input type="number" inputMode="numeric" placeholder="¥" value={lunchSales}
                    onChange={e => setLunchSales(e.target.value)}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm mb-1.5" />
                  <input type="number" inputMode="numeric" placeholder="件" value={lunchOrders}
                    onChange={e => setLunchOrders(e.target.value)}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-1.5">🌙 夜</p>
                  <input type="number" inputMode="numeric" placeholder="¥" value={dinnerSales}
                    onChange={e => setDinnerSales(e.target.value)}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm mb-1.5" />
                  <input type="number" inputMode="numeric" placeholder="件" value={dinnerOrders}
                    onChange={e => setDinnerOrders(e.target.value)}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setManualStep(1)} className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">← 戻る</button>
                <button onClick={() => setManualStep(3)} className="flex-[2] bg-blue-500 text-white font-bold py-3 rounded-xl text-sm">次へ →</button>
              </div>
            </div>
          )}

          {manualStep === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-800">🛵 デリバリー売上（{date}）</p>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-2">🟢 Uber Eats</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" inputMode="numeric" placeholder="¥ 売上" value={uberSales} onChange={e => setUberSales(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                  <input type="number" inputMode="numeric" placeholder="件 注文" value={uberOrders} onChange={e => setUberOrders(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-orange-700 mb-2">🚀 ロケットなう</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" inputMode="numeric" placeholder="¥ 売上" value={rocketnowSales} onChange={e => setRocketnowSales(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                  <input type="number" inputMode="numeric" placeholder="件 注文" value={rocketnowOrders} onChange={e => setRocketnowOrders(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-red-700">🔴 menu</p>
                  <span className="text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">申請準備中</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" inputMode="numeric" placeholder="¥ 売上" value={menuSales} onChange={e => setMenuSales(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                  <input type="number" inputMode="numeric" placeholder="件 注文" value={menuOrders} onChange={e => setMenuOrders(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setManualStep(2)} className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">← 戻る</button>
                <button onClick={() => setManualStep(4)} className="flex-[2] bg-blue-500 text-white font-bold py-3 rounded-xl text-sm">次へ →</button>
              </div>
            </div>
          )}

          {manualStep === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-800">💰 コスト入力（任意）</p>
              <div>
                <label className="text-xs text-gray-500">食材費（円）</label>
                <input type="number" inputMode="numeric" placeholder="¥" value={foodCost}
                  onChange={e => setFoodCost(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm mt-0.5" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700 mb-1">入力内容の確認</p>
                <p>📅 {date}</p>
                {storeSales && <p>🏠 店内: ¥{Number(storeSales).toLocaleString()}{storeOrders ? `（${storeOrders}件）` : ''}</p>}
                {uberSales && <p>🟢 Uber Eats: ¥{Number(uberSales).toLocaleString()}{uberOrders ? `（${uberOrders}件）` : ''}</p>}
                {rocketnowSales && <p>🚀 ロケットなう: ¥{Number(rocketnowSales).toLocaleString()}</p>}
                {menuSales && <p>🔴 menu: ¥{Number(menuSales).toLocaleString()}</p>}
                {foodCost && <p>🥩 食材費: ¥{Number(foodCost).toLocaleString()}</p>}
                <p className="font-semibold text-gray-800 border-t pt-1 mt-1">
                  合計: ¥{((Number(storeSales) || 0) + (Number(uberSales) || 0) + (Number(rocketnowSales) || 0) + (Number(menuSales) || 0)).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setManualStep(3)} className="flex-1 border border-gray-200 text-gray-500 font-semibold py-3 rounded-xl text-sm">← 戻る</button>
                <button onClick={handleManualSave} disabled={saving} className="flex-[2] bg-green-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
                  {saving ? '保存中...' : '✅ 保存する'}
                </button>
              </div>
            </div>
          )}
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

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3">売上内訳（今月）</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🏠 店内（AnyDeli）</span>
              <span className="text-sm font-semibold text-gray-900">¥{monthStore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">🛵 デリバリー計</span>
              <span className="text-sm font-semibold text-gray-900">¥{monthDelivery.toLocaleString()}</span>
            </div>
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
              {monthDelivery === 0 && <p className="text-xs text-gray-400">データなし</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 日別データ一覧 */}
      <div className="mx-4 mt-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-gray-500">今月の日別データ</h2>
          <span className="text-xs text-gray-400">{sales.length}日分</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {sales.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">データがありません</p>
          ) : sales.map(row => {
            const uber      = row.uber_sales ?? 0
            const rocketnow = row.rocketnow_sales ?? 0
            const menu      = row.menu_sales ?? 0
            const hasDetail = uber > 0 || rocketnow > 0 || menu > 0
            const isAnydeli = row.anydeli_sales && row.anydeli_sales > 0

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
                  <div className="flex items-center gap-1">
                    <button onClick={() => generateReport(row.date)}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                      🤖 AI日報
                    </button>
                    <button onClick={() => setDeleteTarget(row.date)}
                      className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded">
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {isAnydeli ? (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      📱 AnyDeli ¥{(row.anydeli_sales ?? 0).toLocaleString()}（{row.store_orders}件）
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      🏠 ¥{row.store_sales.toLocaleString()}（{row.store_orders}件）
                    </span>
                  )}
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

                {/* AnyDeli 現金/オンライン内訳 */}
                {isAnydeli && (row.anydeli_cash_sales || row.anydeli_online_sales) && (
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                      💴 現金 ¥{(row.anydeli_cash_sales ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      💳 オンライン ¥{(row.anydeli_online_sales ?? 0).toLocaleString()}
                    </span>
                  </div>
                )}

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
