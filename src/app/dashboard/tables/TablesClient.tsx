'use client'

import { useState, useEffect, useCallback } from 'react'

/* ─── テーブル呼び出し型 ─── */
type TableCall = {
  id: string
  table_number: number
  table_name: string | null
  call_type: 'staff' | 'water' | 'bill'
  status: 'pending' | 'responded'
  created_at: string
}

const CALL_TYPE_LABEL: Record<string, string> = {
  staff: '🙋 スタッフ呼び出し',
  water: '💧 お水',
  bill:  '💳 お会計',
}

/* ─── 呼び出し通知バナー ─── */
function CallNotificationBanner() {
  const [calls, setCalls] = useState<TableCall[]>([])
  const [responding, setResponding] = useState<string | null>(null)

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/tables/call?status=pending')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setCalls(data)
    } catch {
      // ネットワークエラーは無視
    }
  }, [])

  // 初回 + 30秒ごとにポーリング
  useEffect(() => {
    fetchCalls()
    const id = setInterval(fetchCalls, 30000)
    return () => clearInterval(id)
  }, [fetchCalls])

  const handleRespond = async (callId: string) => {
    setResponding(callId)
    try {
      const res = await fetch('/api/tables/call', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: callId }),
      })
      if (res.ok) {
        setCalls(prev => prev.filter(c => c.id !== callId))
      }
    } finally {
      setResponding(null)
    }
  }

  if (calls.length === 0) return null

  return (
    <div className="mx-4 mt-4 space-y-2">
      {calls.map(call => (
        <div
          key={call.id}
          className="bg-red-50 border border-red-300 rounded-2xl px-4 py-3 flex items-center justify-between"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              🔔 テーブル{call.table_number}番{call.table_name ? `（${call.table_name}）` : ''} から {CALL_TYPE_LABEL[call.call_type] ?? call.call_type} の呼び出し！
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              {new Date(call.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={() => handleRespond(call.id)}
            disabled={responding === call.id}
            className="ml-3 flex-shrink-0 bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
          >
            {responding === call.id ? '処理中...' : '対応済み'}
          </button>
        </div>
      ))}
    </div>
  )
}

type OrderItem = { id: string; name: string; price: number; quantity: number }

type TableOrder = {
  id: string
  table_number: number
  items: OrderItem[]
  total_amount: number
  payment_method: string
  status: string
  note: string | null
  created_at: string
}

type TableData = {
  id: string
  name: string
  table_number: number
  capacity: number
  status: 'empty' | 'occupied' | 'waiting_payment'
  orders: TableOrder[]
  total_amount: number
  order_count: number
}

const STATUS_LABEL: Record<string, string> = {
  empty: '空席',
  occupied: '注文中',
  waiting_payment: '会計待ち',
}

const STATUS_COLOR: Record<string, string> = {
  empty:           'bg-gray-50 border-gray-200 text-gray-400',
  occupied:        'bg-red-50 border-red-300 text-red-700',
  waiting_payment: 'bg-yellow-50 border-yellow-400 text-yellow-700',
}

const STATUS_DOT: Record<string, string> = {
  empty:           'bg-gray-300',
  occupied:        'bg-red-500 animate-pulse',
  waiting_payment: 'bg-yellow-500 animate-pulse',
}

const PAYMENT_LABELS: Record<string, string> = {
  cash:    '💵 現金',
  paypay:  '📱 PayPay',
  card:    '💳 カード',
  line_pay:'LINE Pay',
}

/* ─────────────────────────────── 割り勘モーダル ─────────────────────────── */
function SplitModal({
  total,
  tableName,
  onClose,
}: {
  total: number
  tableName: string
  onClose: () => void
}) {
  const [people, setPeople] = useState(2)
  const perPerson = Math.ceil(total / people)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">割り勘計算</h2>
        <p className="text-sm text-gray-500 mb-5">{tableName} · 合計 ¥{total.toLocaleString()}</p>

        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={() => setPeople(p => Math.max(1, p - 1))}
            className="w-12 h-12 rounded-full border-2 border-gray-200 text-2xl font-bold text-gray-600 flex items-center justify-center active:scale-95 transition-transform"
          >−</button>
          <div className="text-center">
            <p className="text-4xl font-black text-gray-900">{people}</p>
            <p className="text-xs text-gray-400">人</p>
          </div>
          <button
            onClick={() => setPeople(p => Math.min(20, p + 1))}
            className="w-12 h-12 rounded-full border-2 border-gray-200 text-2xl font-bold text-gray-600 flex items-center justify-center active:scale-95 transition-transform"
          >＋</button>
        </div>

        <div className="bg-orange-50 rounded-xl p-4 text-center mb-5">
          <p className="text-xs text-orange-600 mb-1">1人あたり（端数切り上げ）</p>
          <p className="text-4xl font-black text-orange-600">¥{perPerson.toLocaleString()}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────── テーブル詳細モーダル ────────────────────── */
function TableDetailModal({
  table,
  onClose,
  onCheckout,
  onMarkWaiting,
}: {
  table: TableData
  onClose: () => void
  onCheckout: (tableNumber: number, paymentMethod: string) => Promise<void>
  onMarkWaiting: (tableNumber: number) => void
}) {
  const [showSplit, setShowSplit] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [checkouting, setCheckouting] = useState(false)

  const handleCheckout = async () => {
    setCheckouting(true)
    await onCheckout(table.table_number, paymentMethod)
    setCheckouting(false)
    onClose()
  }

  // 注文を時系列順（古い順）に並べる
  const sortedOrders = [...table.orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <>
      {showSplit && (
        <SplitModal
          total={table.total_amount}
          tableName={table.name}
          onClose={() => setShowSplit(false)}
        />
      )}

      <div className="fixed inset-0 bg-black/50 z-40 flex items-end justify-center" onClick={onClose}>
        <div
          className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="px-5 pt-4 pb-3 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-black text-gray-900">{table.name}</h2>
              <p className="text-sm text-gray-500">
                {STATUS_LABEL[table.status]} · {table.capacity}席
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-gray-900">
                ¥{table.total_amount.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">{table.order_count}件の注文</p>
            </div>
          </div>

          {/* 注文内容（スクロール可能） */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
            {sortedOrders.length === 0 ? (
              <p className="text-center py-8 text-gray-400">注文なし</p>
            ) : (
              sortedOrders.map((order, idx) => (
                <div key={order.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-white border rounded-full px-2 py-0.5 font-semibold text-gray-600">
                      注文{idx + 1}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleTimeString('ja-JP', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                    </span>
                  </div>
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-gray-700">{item.name} × {item.quantity}</span>
                      <span className="text-gray-500 font-medium">
                        ¥{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {order.note && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-2">
                      📝 {order.note}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* フッター */}
          {table.status !== 'empty' && (
            <div className="px-5 py-4 border-t flex-shrink-0 space-y-3">
              {/* 支払い方法選択 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">支払い方法</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'cash',    label: '現金' },
                    { key: 'paypay',  label: 'PayPay' },
                    { key: 'card',    label: 'カード' },
                    { key: 'line_pay',label: 'LINE Pay' },
                  ].map(pm => (
                    <button
                      key={pm.key}
                      onClick={() => setPaymentMethod(pm.key)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        paymentMethod === pm.key
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                {/* 割り勘 */}
                <button
                  onClick={() => setShowSplit(true)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                >
                  ÷ 割り勘
                </button>

                {/* 会計待ち */}
                {table.status === 'occupied' && (
                  <button
                    onClick={() => { onMarkWaiting(table.table_number); onClose() }}
                    className="flex-1 py-3 rounded-xl bg-yellow-100 text-yellow-800 text-sm font-semibold"
                  >
                    🟡 会計待ち
                  </button>
                )}

                {/* 会計完了 */}
                <button
                  onClick={handleCheckout}
                  disabled={checkouting}
                  className="flex-1 py-3 rounded-xl bg-green-500 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {checkouting ? '処理中...' : '✅ 会計完了'}
                </button>
              </div>
            </div>
          )}

          {/* 空席の場合は閉じるだけ */}
          {table.status === 'empty' && (
            <div className="px-5 py-4 border-t flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────── テーブル追加モーダル ────────────────────── */
function AddTableModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, tableNumber: number, capacity: number) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name || !tableNumber) return
    setLoading(true)
    await onAdd(name, Number(tableNumber), Number(capacity))
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">テーブルを追加</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">表示名</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: T1 / テーブル1 / カウンター"
              className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">テーブル番号（QRコードの番号と合わせてください）</label>
            <input
              type="number"
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              placeholder="例: 1"
              className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">席数</label>
            <input
              type="number"
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              placeholder="4"
              className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border text-gray-600 text-sm font-semibold">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name || !tableNumber}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-40"
          >
            {loading ? '追加中...' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────── フロアマップ ────────────────────────────── */
const MAP_BG: Record<string, string> = {
  empty:           'bg-gray-100 border-gray-200',
  occupied:        'bg-red-100 border-red-300',
  waiting_payment: 'bg-yellow-100 border-yellow-300',
}

function FloorMapView({
  tables,
  onSelect,
}: {
  tables: TableData[]
  onSelect: (t: TableData) => void
}) {
  if (tables.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
        <p className="text-4xl mb-3">🪑</p>
        <p className="text-gray-500 font-medium">テーブルが登録されていません</p>
      </div>
    )
  }

  // テーブル番号順でソート
  const sorted = [...tables].sort((a, b) => a.table_number - b.table_number)

  return (
    <div className="grid grid-cols-4 gap-3">
      {sorted.map(table => {
        // 着席からの経過時間（最初の注文時刻を基準）
        const firstOrder = table.orders.length > 0
          ? [...table.orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
          : null
        const elapsed = firstOrder
          ? Math.round((Date.now() - new Date(firstOrder.created_at).getTime()) / 60000)
          : null

        return (
          <button
            key={table.id}
            onClick={() => onSelect(table)}
            className={`relative rounded-2xl border-2 p-2 text-center transition-all active:scale-95 aspect-square flex flex-col items-center justify-center gap-0.5 ${MAP_BG[table.status]}`}
          >
            {/* ステータスドット */}
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${STATUS_DOT[table.status]}`} />

            <p className="text-base font-black leading-tight text-gray-800">{table.name}</p>
            <p className="text-[10px] text-gray-500">{table.capacity}席</p>

            {table.status !== 'empty' ? (
              <>
                <p className="text-xs font-bold text-gray-700">¥{table.total_amount.toLocaleString()}</p>
                {elapsed !== null && (
                  <p className="text-[10px] text-gray-500">{elapsed}分</p>
                )}
              </>
            ) : (
              <p className="text-[10px] text-gray-400">空席</p>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────── メイン ─────────────────────────────────── */
export default function TablesClient({ initialTables }: { initialTables: TableData[] }) {
  const [tables, setTables] = useState<TableData[]>(initialTables)
  const [selected, setSelected] = useState<TableData | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [tableReady, setTableReady] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchTables = useCallback(async () => {
    const res = await fetch('/api/tables')
    if (!res.ok) return
    const data = await res.json()
    if (!Array.isArray(data)) { setTableReady(false); return }
    setTableReady(true)
    setTables(data)
  }, [])

  // 30秒ごとに自動更新
  useEffect(() => {
    const id = setInterval(fetchTables, 30000)
    return () => clearInterval(id)
  }, [fetchTables])

  const handleCheckout = async (tableNumber: number, paymentMethod: string) => {
    const res = await fetch('/api/tables/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_number: tableNumber, payment_method: paymentMethod }),
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`✅ 会計完了 ¥${data.total_amount?.toLocaleString()}`)
      await fetchTables()
    }
  }

  const handleMarkWaiting = async (tableNumber: number) => {
    // 対象テーブルの注文を waiting_payment に更新（ベストエフォート）
    const target = tables.find(t => t.table_number === tableNumber)
    if (!target) return
    await Promise.all(
      target.orders.map(o =>
        fetch('/api/menu/order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: o.id, status: 'waiting_payment' }),
        }).catch(() => {})
      )
    )
    await fetchTables()
    showToast('🟡 会計待ちに変更しました')
  }

  const handleAdd = async (name: string, tableNumber: number, capacity: number) => {
    const res = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, table_number: tableNumber, capacity }),
    })
    if (res.ok) {
      await fetchTables()
      showToast(`${name} を追加しました`)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await fetch(`/api/tables?id=${id}`, { method: 'DELETE' })
    await fetchTables()
  }

  // 統計
  const emptyCount    = tables.filter(t => t.status === 'empty').length
  const occupiedCount = tables.filter(t => t.status === 'occupied').length
  const waitingCount  = tables.filter(t => t.status === 'waiting_payment').length
  const totalSales    = tables.reduce((s, t) => s + t.total_amount, 0)

  if (!tableReady) {
    return (
      <div className="px-4 pt-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <p className="font-bold text-yellow-800 mb-2">⚠️ テーブルテーブルが未作成です</p>
          <p className="text-sm text-yellow-700 mb-3">
            Supabase の SQL エディタで以下を実行してください：
          </p>
          <pre className="bg-white border border-yellow-100 rounded-xl p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS tables (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  table_number integer NOT NULL,
  capacity integer DEFAULT 4,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);`}
          </pre>
          <button
            onClick={fetchTables}
            className="mt-3 w-full py-2 bg-yellow-500 text-white rounded-xl text-sm font-bold"
          >
            再確認する
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* 呼び出し通知バナー */}
      <CallNotificationBanner />

      {/* 詳細モーダル */}
      {selected && (
        <TableDetailModal
          table={selected}
          onClose={() => setSelected(null)}
          onCheckout={handleCheckout}
          onMarkWaiting={handleMarkWaiting}
        />
      )}

      {/* 追加モーダル */}
      {showAdd && (
        <AddTableModal
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="px-4 pt-4 pb-6 space-y-4">

        {/* 統計バー */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-2.5 text-center border">
            <p className="text-2xl font-black text-gray-800">{emptyCount}</p>
            <p className="text-[10px] text-gray-400 font-medium">空席</p>
          </div>
          <div className="bg-red-50 rounded-xl p-2.5 text-center border border-red-100">
            <p className="text-2xl font-black text-red-600">{occupiedCount}</p>
            <p className="text-[10px] text-red-400 font-medium">注文中</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-2.5 text-center border border-yellow-100">
            <p className="text-2xl font-black text-yellow-600">{waitingCount}</p>
            <p className="text-[10px] text-yellow-400 font-medium">会計待ち</p>
          </div>
          <div className="bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
            <p className="text-lg font-black text-green-600">¥{(totalSales / 1000).toFixed(0)}k</p>
            <p className="text-[10px] text-green-400 font-medium">本日計</p>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'map' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            🗺️ マップ表示
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            📋 リスト表示
          </button>
        </div>

        {/* マップ表示 */}
        {viewMode === 'map' && (
          <FloorMapView tables={tables} onSelect={setSelected} />
        )}

        {/* リスト表示 */}
        {viewMode === 'list' && (
          tables.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
              <p className="text-4xl mb-3">🪑</p>
              <p className="text-gray-500 font-medium">テーブルが登録されていません</p>
              <p className="text-sm text-gray-400 mt-1">下の「＋ テーブルを追加」から登録してください</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => setSelected(table)}
                  className={`relative rounded-2xl border-2 p-3 text-left transition-all active:scale-95 ${STATUS_COLOR[table.status]}`}
                >
                  {/* ステータスドット */}
                  <span className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${STATUS_DOT[table.status]}`} />

                  <p className="text-lg font-black leading-tight">{table.name}</p>
                  <p className="text-[10px] font-medium opacity-70 mb-1">{table.capacity}席</p>

                  {table.status !== 'empty' ? (
                    <>
                      <p className="text-base font-bold">¥{table.total_amount.toLocaleString()}</p>
                      <p className="text-[10px] opacity-70">{table.order_count}件</p>
                      <p className="text-[10px] font-bold mt-1">
                        {STATUS_LABEL[table.status]}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm opacity-50">空席</p>
                  )}
                </button>
              ))}
            </div>
          )
        )}

        {/* アクションボタン */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowAdd(true)}
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold active:scale-95 transition-transform"
          >
            ＋ テーブルを追加
          </button>
          <button
            onClick={fetchTables}
            className="px-4 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold"
          >
            🔄 更新
          </button>
        </div>

        {/* テーブル削除（管理用） */}
        {tables.length > 0 && (
          <details className="bg-white rounded-xl border p-4">
            <summary className="text-xs font-semibold text-gray-400 cursor-pointer">
              テーブルを削除する（管理者）
            </summary>
            <div className="mt-3 space-y-2">
              {tables.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{t.name}（T{t.table_number}）</span>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="text-xs text-red-500 px-3 py-1 rounded-lg border border-red-200"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  )
}
