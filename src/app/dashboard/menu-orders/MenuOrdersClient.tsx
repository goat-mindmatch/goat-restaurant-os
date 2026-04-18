'use client'

import { useState } from 'react'

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
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)

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
    <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-orange-400">
      {/* ヘッダー */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-2xl font-black text-gray-900">{order.table_number}番</span>
          <p className="text-xs text-gray-400 mt-0.5">
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

      {/* ボタン */}
      {!confirmCancel ? (
        <div className="flex gap-2">
          <button
            onClick={handleServed}
            disabled={serving}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold disabled:opacity-50"
          >
            {serving ? '処理中...' : '✅ 提供完了'}
          </button>
          <button
            onClick={() => setConfirmCancel(true)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 font-semibold hover:bg-gray-50"
          >
            キャンセル
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
            {cancelling ? '処理中...' : '⚠️ キャンセルする'}
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

  const handleServed = (id: string) => {
    const order = orders.find(o => o.id === id)
    if (order) {
      setOrders(prev => prev.filter(o => o.id !== id))
      setServed(prev => [{ ...order, status: 'served' }, ...prev])
    }
  }

  const handleCancel = (id: string) => {
    const order = orders.find(o => o.id === id)
    if (order) {
      setOrders(prev => prev.filter(o => o.id !== id))
      setCancelled(prev => [{ ...order, status: 'cancelled' }, ...prev])
    }
  }

  const doneCount = served.length + cancelled.length

  if (orders.length === 0 && doneCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <p className="text-5xl mb-4">🍜</p>
        <p className="text-gray-500 font-medium">本日の注文はまだありません</p>
        <p className="text-sm text-gray-400 mt-1">テーブルのQRコードから注文が入ると表示されます</p>
      </div>
    )
  }

  return (
    <div className="px-4 mt-4 space-y-3 pb-4">
      {/* アクティブな注文 */}
      {orders.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">現在の注文はありません</div>
      )}
      {orders.map(o => (
        <OrderCard key={o.id} order={o} onServed={handleServed} onCancel={handleCancel} />
      ))}

      {/* 提供完了・キャンセル済み（折りたたみ） */}
      {doneCount > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowDone(!showDone)}
            className="text-xs text-gray-400 font-semibold"
          >
            {showDone ? '▲' : '▼'} 完了済み ({doneCount}件)
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {served.map(o => (
                <div key={o.id} className="bg-white rounded-xl p-3 opacity-60">
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
                <div key={o.id} className="bg-white rounded-xl p-3 opacity-50">
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
