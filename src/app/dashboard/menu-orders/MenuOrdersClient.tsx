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

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ 受付中',
  confirmed: '✅ 確認済み',
  cooking: '🔥 調理中',
  ready: '🍜 提供可能',
  served: '✨ 提供済み',
  cancelled: '❌ キャンセル',
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: '💵 現金',
  paypay: '📱 PayPay',
  line_pay: 'LINE Pay',
  card: 'クレカ',
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'cooking',
  confirmed: 'cooking',
  cooking: 'ready',
  ready: 'served',
}

const NEXT_LABEL: Record<string, string> = {
  pending: '🔥 調理開始',
  confirmed: '🔥 調理開始',
  cooking: '🍜 提供可能',
  ready: '✨ 提供済みにする',
}

function OrderCard({ order, onStatusUpdate }: { order: CustomerOrder; onStatusUpdate: (id: string, status: string) => void }) {
  const [updating, setUpdating] = useState(false)
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)

  const handleUpdate = async () => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    setUpdating(true)
    const res = await fetch(`/api/menu/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, status: next }),
    })
    setUpdating(false)
    if (res.ok) onStatusUpdate(order.id, next)
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 ${
      order.status === 'pending' ? 'border-l-4 border-orange-400' :
      order.status === 'cooking' ? 'border-l-4 border-red-400' :
      order.status === 'ready' ? 'border-l-4 border-green-400' : ''
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-gray-900">{order.table_number}番</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              order.status === 'pending' ? 'bg-orange-100 text-orange-700' :
              order.status === 'cooking' ? 'bg-red-100 text-red-700' :
              order.status === 'ready' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {elapsed}分前 · {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
          </p>
        </div>
        <p className="font-bold text-gray-900">¥{order.total_amount.toLocaleString()}</p>
      </div>

      {/* 注文内容 */}
      <div className="space-y-0.5 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.name} × {item.quantity}</span>
            <span className="text-gray-500">¥{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {order.note && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-yellow-800">📝 {order.note}</p>
        </div>
      )}

      {NEXT_STATUS[order.status] && (
        <button
          onClick={handleUpdate}
          disabled={updating}
          className={`w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 ${
            order.status === 'cooking'
              ? 'bg-green-500 text-white'
              : order.status === 'ready'
              ? 'bg-gray-600 text-white'
              : 'bg-orange-500 text-white'
          }`}
        >
          {updating ? '更新中...' : NEXT_LABEL[order.status]}
        </button>
      )}
    </div>
  )
}

export default function MenuOrdersClient({
  pendingOrders,
  cookingOrders,
  doneOrders,
}: {
  pendingOrders: CustomerOrder[]
  cookingOrders: CustomerOrder[]
  doneOrders: CustomerOrder[]
}) {
  const [pending, setPending] = useState(pendingOrders)
  const [cooking, setCooking] = useState(cookingOrders)
  const [done, setDone] = useState(doneOrders)

  const handleStatusUpdate = (id: string, newStatus: string) => {
    const move = (from: CustomerOrder[], setFrom: (v: CustomerOrder[]) => void) => {
      const order = from.find(o => o.id === id)
      if (!order) return false
      setFrom(from.filter(o => o.id !== id))
      const updated = { ...order, status: newStatus }
      if (newStatus === 'cooking') setCooking(prev => [updated, ...prev])
      else if (newStatus === 'ready') { setCooking(prev => prev.filter(o => o.id !== id)); setDone(prev => [updated, ...prev]); }
      else if (newStatus === 'served') setDone(prev => [updated, ...prev.filter(o => o.id !== id)])
      return true
    }
    if (!move(pending, setPending)) {
      move(cooking, setCooking)
    }
  }

  const totalActive = pending.length + cooking.length

  if (totalActive === 0 && done.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <p className="text-5xl mb-4">🍜</p>
        <p className="text-gray-500 font-medium">本日の注文はまだありません</p>
        <p className="text-sm text-gray-400 mt-1">テーブルのQRコードから注文が入ると表示されます</p>
      </div>
    )
  }

  return (
    <div className="px-4 mt-4 space-y-6">
      {/* 対応待ち */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-orange-600 mb-3 flex items-center gap-1">
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
            対応待ち
          </h2>
          <div className="space-y-3">
            {pending.map(o => (
              <OrderCard key={o.id} order={o} onStatusUpdate={handleStatusUpdate} />
            ))}
          </div>
        </section>
      )}

      {/* 調理中 */}
      {cooking.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-1">
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{cooking.length}</span>
            調理中
          </h2>
          <div className="space-y-3">
            {cooking.map(o => (
              <OrderCard key={o.id} order={o} onStatusUpdate={handleStatusUpdate} />
            ))}
          </div>
        </section>
      )}

      {/* 完了 */}
      {done.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-400 mb-3">完了 ({done.length}件)</h2>
          <div className="space-y-2">
            {done.map(o => (
              <div key={o.id} className="bg-white rounded-xl p-3 opacity-60">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-600">{o.table_number}番 · {STATUS_LABELS[o.status]}</span>
                  <span className="text-gray-500">¥{o.total_amount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {o.items.map((i: OrderItem) => `${i.name}×${i.quantity}`).join(' / ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
