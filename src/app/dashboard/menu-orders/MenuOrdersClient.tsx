'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type OrderItem = { id: string; name: string; price: number; quantity: number }

type CustomerOrder = {
  id: string
  table_number: number
  items: OrderItem[]
  total_amount: number
  payment_method: string
  status: string
  note: string | null
  created_at: string
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 現金',
  paypay: '📱 PayPay',
  line_pay: 'LINE Pay',
  card: 'クレカ',
}

function OrderCard({
  order,
  onServed,
  onCancel,
}: {
  order: CustomerOrder
  onServed: (id: string) => void
  onCancel: (id: string) => void
}) {
  const [serving, setServing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // 経過時間（リアルタイム更新）
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
  )
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000))
    }, 30000)
    return () => clearInterval(id)
  }, [order.created_at])

  const isUrgent = elapsed >= 10

  const handleServed = async () => {
    setServing(true)
    const res = await fetch('/api/menu/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, status: 'served' }),
    })
    setServing(false)
    if (res.ok) onServed(order.id)
  }

  const handleCancel = async () => {
    setCancelling(true)
    const res = await fetch('/api/menu/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, status: 'cancelled' }),
    })
    setCancelling(false)
    if (res.ok) onCancel(order.id)
    else setConfirmCancel(false)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 transition-all ${
      isUrgent ? 'border-red-500' : 'border-orange-400'
    }`}>
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-gray-900">{order.table_number}番</span>
            {isUrgent && (
              <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full animate-pulse">
                ⚡ {elapsed}分経過
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${isUrgent ? 'text-red-500' : 'text-gray-400'}`}>
            {elapsed === 0 ? 'たった今' : `${elapsed}分前`}
            &nbsp;·&nbsp;
            {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
          </p>
        </div>
        <p className="text-xl font-bold text-gray-900">¥{order.total_amount.toLocaleString()}</p>
      </div>

      {/* 注文内容 */}
      <div className="space-y-1 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">{item.name} × {item.quantity}</span>
            <span className="text-gray-500">¥{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* メモ */}
      {order.note && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-yellow-800">📝 {order.note}</p>
        </div>
      )}

      {/* アクションボタン */}
      {!confirmCancel ? (
        <div className="flex gap-2">
          <button
            onClick={handleServed}
            disabled={serving}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {serving ? '処理中...' : '✅ 提供完了'}
          </button>
          <button
            onClick={() => setConfirmCancel(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-semibold hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmCancel(false)}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-semibold"
          >
            戻る
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
          >
            {cancelling ? '処理中...' : '⚠️ キャンセル確定'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function MenuOrdersClient({
  orders: initialOrders,
}: {
  orders: CustomerOrder[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [served, setServed] = useState<CustomerOrder[]>([])
  const [cancelled, setCancelled] = useState<CustomerOrder[]>([])
  const [showDone, setShowDone] = useState(false)

  // トースト（新着通知）
  const [newOrderToast, setNewOrderToast] = useState(false)
  // 接続エラーバナー
  const [connectionError, setConnectionError] = useState(false)
  // 最終更新時刻
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [secondsSince, setSecondsSince] = useState(0)
  // Undoトースト
  const [undoInfo, setUndoInfo] = useState<{
    orderId: string
    type: 'served' | 'cancel'
    order: CustomerOrder
    countdown: number
  } | null>(null)

  const newOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoCountRef     = useRef<ReturnType<typeof setInterval> | null>(null)

  // ポーリング（20秒）
  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/orders')
      if (!res.ok) { setConnectionError(true); return }
      setConnectionError(false)
      setLastUpdated(new Date())
      setSecondsSince(0)
      const { orders: fetched }: { orders: CustomerOrder[] } = await res.json()

      setOrders(prev => {
        const prevIds = new Set(prev.map(o => o.id))
        const newItems = fetched.filter(o => !prevIds.has(o.id))
        if (newItems.length > 0) {
          if (newOrderTimerRef.current) clearTimeout(newOrderTimerRef.current)
          setNewOrderToast(true)
          newOrderTimerRef.current = setTimeout(() => setNewOrderToast(false), 3000)
          return [...newItems, ...prev]
        }
        return prev
      })
    } catch {
      setConnectionError(true)
    }
  }, [])

  useEffect(() => {
    const pollId    = setInterval(poll, 20000)
    const secondsId = setInterval(() => setSecondsSince(s => s + 1), 1000)
    return () => {
      clearInterval(pollId)
      clearInterval(secondsId)
      if (newOrderTimerRef.current) clearTimeout(newOrderTimerRef.current)
      if (undoTimerRef.current)     clearTimeout(undoTimerRef.current)
      if (undoCountRef.current)     clearInterval(undoCountRef.current)
    }
  }, [poll])

  // Undoセット（5秒カウントダウン）
  const startUndo = (orderId: string, type: 'served' | 'cancel', order: CustomerOrder) => {
    if (undoTimerRef.current)  clearTimeout(undoTimerRef.current)
    if (undoCountRef.current)  clearInterval(undoCountRef.current)
    setUndoInfo({ orderId, type, order, countdown: 5 })
    undoCountRef.current = setInterval(() => {
      setUndoInfo(prev => {
        if (!prev) return null
        if (prev.countdown <= 1) {
          clearInterval(undoCountRef.current!)
          return null
        }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)
  }

  const handleServed = (id: string) => {
    const order = orders.find(o => o.id === id)
    if (!order) return
    setOrders(prev => prev.filter(o => o.id !== id))
    setServed(prev => [{ ...order, status: 'served' }, ...prev])
    startUndo(id, 'served', order)
  }

  const handleCancel = (id: string) => {
    const order = orders.find(o => o.id === id)
    if (!order) return
    setOrders(prev => prev.filter(o => o.id !== id))
    setCancelled(prev => [{ ...order, status: 'cancelled' }, ...prev])
    startUndo(id, 'cancel', order)
  }

  // Undo実行
  const handleUndo = async () => {
    if (!undoInfo) return
    const { orderId, type, order } = undoInfo
    clearInterval(undoCountRef.current!)
    clearTimeout(undoTimerRef.current!)
    setUndoInfo(null)
    // DB を pending に戻す（ベストエフォート）
    await fetch('/api/menu/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status: 'pending' }),
    }).catch(() => {})
    // UI を戻す
    if (type === 'served') setServed(prev => prev.filter(o => o.id !== orderId))
    else setCancelled(prev => prev.filter(o => o.id !== orderId))
    setOrders(prev => [order, ...prev])
  }

  const doneCount = served.length + cancelled.length

  // 最終更新テキスト
  const updatedText = secondsSince < 60
    ? `${secondsSince}秒前`
    : `${Math.floor(secondsSince / 60)}分前`

  return (
    <div className="px-4 mt-2 pb-4 space-y-3">
      {/* 接続エラーバナー（常時チェック） */}
      {connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-red-500 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-bold text-red-700">通信エラー</p>
            <p className="text-xs text-red-600">注文の自動更新に失敗しています。ページを再読み込みしてください。</p>
          </div>
        </div>
      )}

      {/* 最終更新時刻バー */}
      <div className="flex justify-between items-center text-xs text-gray-400 px-1">
        <span>🔄 20秒ごと自動更新</span>
        <span className={connectionError ? 'text-red-400' : ''}>
          {connectionError ? '⚠️ 更新停止中' : `最終更新: ${updatedText}`}
        </span>
      </div>

      {/* 注文ゼロ状態 */}
      {orders.length === 0 && doneCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-5xl mb-4">🍜</p>
          <p className="text-gray-500 font-medium">本日の注文はまだありません</p>
          <p className="text-sm text-gray-400 mt-1">テーブルのQRコードから注文が入ると表示されます</p>
        </div>
      )}

      {/* 新着トースト */}
      {newOrderToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-lg animate-bounce">
          🔔 新しい注文が入りました！
        </div>
      )}

      {/* Undoトースト */}
      {undoInfo && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm bg-gray-900 text-white text-sm rounded-2xl shadow-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>
            {undoInfo.type === 'served' ? '✅ 提供完了' : '❌ キャンセル'}しました
          </span>
          <button
            onClick={handleUndo}
            className="bg-white text-gray-900 font-bold px-3 py-1.5 rounded-xl text-xs flex-shrink-0"
          >
            元に戻す ({undoInfo.countdown}s)
          </button>
        </div>
      )}

      {/* アクティブな注文 */}
      {orders.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl">
          現在の未対応注文はありません
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 px-1">
            対応待ち <span className="text-orange-500 text-base font-black">{orders.length}</span>件
          </p>
          {orders.map(o => (
            <OrderCard key={o.id} order={o} onServed={handleServed} onCancel={handleCancel} />
          ))}
        </>
      )}

      {/* 完了済み（折りたたみ） */}
      {doneCount > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowDone(!showDone)}
            className="w-full text-xs text-gray-400 font-semibold py-2 bg-white rounded-xl border"
          >
            {showDone ? '▲' : '▼'} 完了済み ({doneCount}件)
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {served.map(o => (
                <div key={o.id} className="bg-white rounded-xl p-3 opacity-60 border border-green-100">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-600">{o.table_number}番 · ✅ 提供完了</span>
                    <span className="text-gray-500">¥{o.total_amount.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {o.items.map(i => `${i.name}×${i.quantity}`).join(' / ')}
                  </p>
                </div>
              ))}
              {cancelled.map(o => (
                <div key={o.id} className="bg-white rounded-xl p-3 opacity-50 border border-red-100">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-500">{o.table_number}番 · ❌ キャンセル</span>
                    <span className="text-gray-400">¥{o.total_amount.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {o.items.map(i => `${i.name}×${i.quantity}`).join(' / ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
