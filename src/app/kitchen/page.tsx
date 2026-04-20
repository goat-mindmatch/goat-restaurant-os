'use client'

/**
 * 厨房ディスプレイ — /kitchen
 * タブレット・モニター設置専用の全画面画面
 * ナビなし・大文字・自動更新・ステータス変更対応
 */

import { useState, useEffect, useCallback, useRef } from 'react'

type OrderItem = { id: string; name: string; price: number; quantity: number }

type Order = {
  id: string
  table_number: number
  items: OrderItem[]
  total_amount: number
  payment_method: string
  status: string
  note: string | null
  created_at: string
}

const STATUS_FLOW: Record<string, string> = {
  pending:   'cooking',
  confirmed: 'cooking',
  cooking:   'ready',
  ready:     'served',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   '⏳ 受付済み',
  confirmed: '⏳ 確認済み',
  cooking:   '🔥 調理中',
  ready:     '✅ 提供可能',
}

const STATUS_BG: Record<string, string> = {
  pending:   'bg-blue-50 border-blue-400',
  confirmed: 'bg-blue-50 border-blue-400',
  cooking:   'bg-orange-50 border-orange-500',
  ready:     'bg-green-50 border-green-500',
}

const STATUS_HEADER: Record<string, string> = {
  pending:   'bg-blue-500',
  confirmed: 'bg-blue-500',
  cooking:   'bg-orange-500',
  ready:     'bg-green-500',
}

const NEXT_LABEL: Record<string, string> = {
  pending:   '🔥 調理開始',
  confirmed: '🔥 調理開始',
  cooking:   '✅ 提供できます',
  ready:     '🍽️ 提供完了',
}

function ElapsedBadge({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    }, 30000)
    return () => clearInterval(id)
  }, [createdAt])

  const isUrgent = elapsed >= 10
  return (
    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
      isUrgent ? 'bg-red-500 text-white animate-pulse' : 'bg-white/60 text-gray-600'
    }`}>
      {elapsed === 0 ? 'いま' : `${elapsed}分`}
    </span>
  )
}

function KitchenCard({
  order,
  onNext,
}: {
  order: Order
  onNext: (id: string, nextStatus: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const next = STATUS_FLOW[order.status]

  const handle = async () => {
    if (!next) return
    setLoading(true)
    await onNext(order.id, next)
    setLoading(false)
  }

  return (
    <div className={`rounded-2xl border-2 overflow-hidden flex flex-col ${STATUS_BG[order.status]}`}>
      {/* ヘッダー */}
      <div className={`${STATUS_HEADER[order.status]} px-4 py-2 flex items-center justify-between`}>
        <span className="text-white text-xl font-black">T{order.table_number}</span>
        <div className="flex items-center gap-2">
          <ElapsedBadge createdAt={order.created_at} />
          <span className="text-white text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
            {STATUS_LABEL[order.status]}
          </span>
        </div>
      </div>

      {/* 注文内容 */}
      <div className="px-4 py-3 flex-1 space-y-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-baseline">
            <span className="text-xl font-bold text-gray-900">{item.name}</span>
            <span className="text-2xl font-black text-gray-900 ml-2">×{item.quantity}</span>
          </div>
        ))}
        {order.note && (
          <p className="text-sm text-yellow-800 bg-yellow-100 rounded-lg px-3 py-2 mt-2">
            📝 {order.note}
          </p>
        )}
      </div>

      {/* アクションボタン */}
      {next && (
        <div className="px-4 pb-4">
          <button
            onClick={handle}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gray-900 text-white text-lg font-bold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? '...' : NEXT_LABEL[order.status]}
          </button>
        </div>
      )}
    </div>
  )
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [connectionError, setConnectionError] = useState(false)
  const [newToast, setNewToast] = useState(false)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/orders')
      if (!res.ok) { setConnectionError(true); return }
      setConnectionError(false)
      const { orders: fetched }: { orders: Order[] } = await res.json()

      // 新着検知
      const newIds = fetched.filter(o => !prevIdsRef.current.has(o.id))
      if (newIds.length > 0) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setNewToast(true)
        toastTimerRef.current = setTimeout(() => setNewToast(false), 4000)
      }
      prevIdsRef.current = new Set(fetched.map(o => o.id))

      // キッチン表示順: pending/confirmed → cooking → ready（古い順）
      const sorted = [...fetched].sort((a, b) => {
        const priority: Record<string, number> = { pending: 0, confirmed: 1, cooking: 2, ready: 3 }
        const pa = priority[a.status] ?? 99
        const pb = priority[b.status] ?? 99
        if (pa !== pb) return pa - pb
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      setOrders(sorted)
      setLastUpdated(new Date())
    } catch {
      setConnectionError(true)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const id = setInterval(fetchOrders, 8000)
    return () => {
      clearInterval(id)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [fetchOrders])

  const handleNext = async (orderId: string, nextStatus: string) => {
    await fetch('/api/menu/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status: nextStatus }),
    })
    await fetchOrders()
  }

  const time = lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 新着トースト */}
      {newToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-lg font-black px-8 py-4 rounded-2xl shadow-2xl animate-bounce">
          🔔 新しい注文が入りました！
        </div>
      )}

      {/* ヘッダー */}
      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black">👨‍🍳 厨房</span>
          <span className="text-sm text-gray-400">人類みなまぜそば</span>
        </div>
        <div className="flex items-center gap-4">
          {connectionError ? (
            <span className="text-red-400 text-sm font-semibold animate-pulse">⚠️ 接続エラー</span>
          ) : (
            <span className="text-gray-400 text-sm">{time} 更新</span>
          )}
          <a
            href="/dashboard/tables"
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            テーブル管理 →
          </a>
        </div>
      </div>

      {/* 注文ゼロ */}
      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
          <p className="text-7xl mb-6">🍜</p>
          <p className="text-2xl font-bold text-gray-400">待機中</p>
          <p className="text-gray-500 mt-2">注文が入ると自動で表示されます</p>
        </div>
      )}

      {/* 注文カード */}
      {orders.length > 0 && (
        <div className="p-4">
          {/* 件数サマリー */}
          <div className="flex gap-3 mb-4">
            {(['pending', 'confirmed', 'cooking', 'ready'] as const).map(st => {
              const count = orders.filter(o =>
                st === 'pending' ? (o.status === 'pending' || o.status === 'confirmed') :
                o.status === st
              ).length
              if (count === 0 && st === 'confirmed') return null
              const colors: Record<string, string> = {
                pending: 'bg-blue-600',
                cooking: 'bg-orange-500',
                ready: 'bg-green-500',
              }
              return st !== 'confirmed' ? (
                <div key={st} className={`flex items-center gap-2 ${colors[st]} px-3 py-1.5 rounded-full`}>
                  <span className="text-white font-black text-lg">{count}</span>
                  <span className="text-white text-xs font-semibold">
                    {st === 'pending' ? '受付' : st === 'cooking' ? '調理中' : '提供待ち'}
                  </span>
                </div>
              ) : null
            })}
          </div>

          {/* カードグリッド */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {orders.map(order => (
              <KitchenCard key={order.id} order={order} onNext={handleNext} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
