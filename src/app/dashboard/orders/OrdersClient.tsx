'use client'

import { useState } from 'react'

type Order = {
  id: string
  supplier_name: string
  order_date: string
  delivery_date: string | null
  items: { name: string; quantity: number; unit: string; unit_price?: number }[]
  total_amount: number | null
  status: string
  note: string | null
}

type Supplier = {
  id: string
  name: string
  contact_type: string
  contact_value: string
  note: string | null
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft: { text: '下書き', color: 'bg-gray-100 text-gray-600' },
  sent: { text: '送付済', color: 'bg-blue-100 text-blue-700' },
  delivered: { text: '納品済', color: 'bg-green-100 text-green-700' },
  cancelled: { text: 'キャンセル', color: 'bg-red-100 text-red-600' },
}

export default function OrdersClient({ orders, suppliers }: { orders: Order[]; suppliers: Supplier[] }) {
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [newSupName, setNewSupName] = useState('')
  const [newSupContact, setNewSupContact] = useState('')
  const [showOrderForm, setShowOrderForm] = useState<Order | null>(null)
  const [sendText, setSendText] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const addSupplier = async () => {
    if (!newSupName.trim()) return
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSupName, contact_type: 'line', contact_value: newSupContact }),
    })
    if (res.ok) {
      setNewSupName('')
      setNewSupContact('')
      setMessage('✅ 取引先を追加しました')
      setTimeout(() => window.location.reload(), 500)
    }
  }

  const sendOrder = async (orderId: string) => {
    const res = await fetch('/api/orders/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    })
    if (res.ok) {
      const data = await res.json()
      setSendText(data.message)
    }
  }

  const copyToClipboard = () => {
    if (sendText) {
      navigator.clipboard.writeText(sendText)
      setMessage('✅ コピーしました！業者さんへ貼り付けて送信してください')
    }
  }

  const pendingOrders = orders.filter(o => o.status === 'draft')
  const sentOrders = orders.filter(o => o.status !== 'draft')

  return (
    <>
      {message && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow z-50 text-sm">
          {message}
          <button className="ml-3 opacity-60" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* 取引先管理 */}
      <div className="mx-4 mt-4 bg-white rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-gray-700">取引先 ({suppliers.length}件)</h2>
          <button onClick={() => setShowSupplierForm(!showSupplierForm)}
            className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded">
            {showSupplierForm ? '閉じる' : '＋追加'}
          </button>
        </div>

        {showSupplierForm && (
          <div className="space-y-2 mb-3 pb-3 border-b">
            <input type="text" placeholder="業者名（例: 製麺屋さん）" value={newSupName} onChange={e => setNewSupName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <input type="text" placeholder="連絡先（LINE ID / 電話番号など）" value={newSupContact} onChange={e => setNewSupContact(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <button onClick={addSupplier}
              className="w-full bg-blue-500 text-white text-sm font-bold py-2 rounded-lg">追加する</button>
          </div>
        )}

        {suppliers.length === 0 ? (
          <p className="text-xs text-gray-400">取引先を登録してください</p>
        ) : (
          <div className="space-y-1">
            {suppliers.map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1">
                <span className="font-medium text-gray-800">{s.name}</span>
                <span className="text-xs text-gray-400">{s.contact_value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 未送付の発注 */}
      {pendingOrders.length > 0 && (
        <div className="mx-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            送付待ち ({pendingOrders.length}件)
          </h2>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {pendingOrders.map(order => {
              const label = STATUS_LABEL[order.status] ?? STATUS_LABEL.draft
              return (
                <div key={order.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800">{order.supplier_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${label.color}`}>{label.text}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        発注: {order.order_date}
                        {order.delivery_date && ` / 配達希望: ${order.delivery_date}`}
                      </p>
                    </div>
                    <button onClick={() => sendOrder(order.id)}
                      className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded">
                      📤 送付
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {order.items.map((it, i) => (
                      <div key={i}>・{it.name} {it.quantity}{it.unit}</div>
                    ))}
                  </div>
                  {order.note && (
                    <p className="text-xs text-gray-500 mt-1">備考: {order.note}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 送付済みの発注 */}
      {sentOrders.length > 0 && (
        <div className="mx-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">送付済み・完了</h2>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {sentOrders.map(order => {
              const label = STATUS_LABEL[order.status] ?? STATUS_LABEL.draft
              return (
                <div key={order.id} className="p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{order.supplier_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${label.color}`}>{label.text}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {order.order_date} / {order.items.length}品目
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* コピペ用テキストモーダル */}
      {sendText && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setSendText(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">発注メッセージ</h3>
              <p className="text-xs text-gray-500">業者さんへLINEで送る内容です</p>
            </div>
            <div className="p-4">
              <pre className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap font-sans">{sendText}</pre>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={copyToClipboard}
                className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-lg">📋 コピー</button>
              <button onClick={() => setSendText(null)}
                className="px-4 bg-gray-100 rounded-lg">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* 発注フォームへの誘導 */}
      <div className="mx-4 mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        💡 スタッフがLINEの「📦発注依頼」ボタンから発注を出すと、ここに一覧表示されます。
      </div>
    </>
  )
}
