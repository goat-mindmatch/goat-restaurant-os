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
  alert_sent_at: string | null
}

type Supplier = {
  id: string
  name: string
  contact_type: string
  contact_value: string
  note: string | null
}

type NewItem = { name: string; quantity: string; unit: string }

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft:     { text: '下書き',    color: 'bg-gray-100 text-gray-600' },
  sent:      { text: '送付済',    color: 'bg-blue-100 text-blue-700' },
  delivered: { text: '納品済',    color: 'bg-green-100 text-green-700' },
  cancelled: { text: 'キャンセル', color: 'bg-red-100 text-red-600' },
}

export default function OrdersClient({ orders: initialOrders, suppliers }: { orders: Order[]; suppliers: Supplier[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [newSupName, setNewSupName]           = useState('')
  const [newSupContact, setNewSupContact]     = useState('')
  const [newSupEmail, setNewSupEmail]         = useState('')
  const [newSupContactMethod, setNewSupContactMethod] = useState<'line' | 'email' | 'both'>('line')
  const [sendText, setSendText] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ email_sent: boolean; email_error?: string | null; supplier_email: string | null; contact_method: string } | null>(null)
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null)
  const [emailSending, setEmailSending]     = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showNewOrder, setShowNewOrder] = useState(false)

  // 新規発注フォーム
  const [newSupplierId, setNewSupplierId] = useState(suppliers[0]?.id ?? '')
  const [newDeliveryDate, setNewDeliveryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
  })
  const [newItems, setNewItems] = useState<NewItem[]>([{ name: '', quantity: '', unit: 'kg' }])
  const [newNote, setNewNote] = useState('')
  const [submittingNew, setSubmittingNew] = useState(false)

  const toast = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  // 取引先追加
  const addSupplier = async () => {
    if (!newSupName.trim()) return
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:           newSupName.trim(),
        contact_type:   newSupContactMethod,
        contact_value:  newSupContact.trim(),
        email:          newSupEmail.trim() || null,
        contact_method: newSupContactMethod,
      }),
    })
    if (res.ok) {
      setNewSupName(''); setNewSupContact(''); setNewSupEmail(''); setNewSupContactMethod('line')
      toast('✅ 取引先を追加しました')
      setTimeout(() => window.location.reload(), 600)
    } else {
      const d = await res.json() as { error?: string }
      toast(`❌ ${d.error ?? '追加に失敗しました'}`)
    }
  }

  // 新規発注作成
  const submitNewOrder = async () => {
    if (!newSupplierId) return toast('❌ 取引先を選んでください')
    const valid = newItems.filter(it => it.name.trim() && it.quantity)
    if (valid.length === 0) return toast('❌ 品目を1つ以上入力してください')
    setSubmittingNew(true)
    try {
      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: newSupplierId,
          items: valid.map(it => ({ name: it.name, quantity: Number(it.quantity), unit: it.unit })),
          delivery_date: newDeliveryDate,
          note: newNote || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast('✅ 発注を作成しました')
      setShowNewOrder(false)
      setNewItems([{ name: '', quantity: '', unit: 'kg' }])
      setNewNote('')
      setTimeout(() => window.location.reload(), 600)
    } catch (e) {
      toast('❌ ' + (e as Error).message)
    }
    setSubmittingNew(false)
  }

  // 発注送付テキスト生成 + メール自動送信
  const sendOrder = async (orderId: string) => {
    setSendingOrderId(orderId)
    toast('📤 発注メッセージを作成中...')
    const res = await fetch('/api/orders/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    })
    if (res.ok) {
      const data = await res.json() as {
        message: string
        email_sent: boolean
        email_error?: string | null
        line_notified: boolean
        supplier: { name: string; email: string | null; contact_method: string }
      }
      setSendText(data.message)
      setSendResult({
        email_sent: data.email_sent,
        email_error: data.email_error ?? null,
        supplier_email: data.supplier?.email ?? null,
        contact_method: data.supplier?.contact_method ?? 'line',
      })
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'sent' } : o))
    } else {
      toast('❌ メッセージ作成に失敗しました')
      setSendingOrderId(null)
    }
  }

  // メール送付（モーダルから手動送信）
  const sendEmailNow = async (testEmail?: string) => {
    if (!sendingOrderId) return
    setEmailSending(true)
    try {
      const res = await fetch('/api/orders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id:    sendingOrderId,
          force_email: true,
          test_email:  testEmail ?? undefined,
        }),
      })
      const data = await res.json() as { email_sent: boolean; email_error?: string | null; supplier: { email: string | null; contact_method: string } }
      if (data.email_sent) {
        setSendResult(prev => prev ? { ...prev, email_sent: true, email_error: null } : prev)
        toast(`✅ メールを送信しました${testEmail ? `（テスト → ${testEmail}）` : ''}`)
      } else {
        // エラー内容をモーダルにも反映
        setSendResult(prev => prev ? { ...prev, email_error: data.email_error ?? '送信失敗' } : prev)
        toast(`❌ 送信失敗: ${data.email_error ?? '不明なエラー'}`)
      }
    } catch (e) {
      setSendResult(prev => prev ? { ...prev, email_error: (e as Error).message } : prev)
      toast('❌ ' + (e as Error).message)
    }
    setEmailSending(false)
  }

  // テスト送付（任意のメールアドレスへ）
  const sendTestEmail = async () => {
    const email = window.prompt('テスト送付先のメールアドレスを入力してください：\n（例：your@email.com）')
    if (!email?.trim()) return
    await sendEmailNow(email.trim())
  }

  // ステータス更新（納品済み / キャンセル）
  const updateStatus = async (orderId: string, status: string) => {
    const res = await fetch('/api/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status }),
    })
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
      toast(status === 'delivered' ? '✅ 納品済みにしました' : '🗑 キャンセルしました')
    }
  }

  const copyToClipboard = () => {
    if (sendText) {
      navigator.clipboard.writeText(sendText)
      toast('✅ コピーしました！業者さんへ貼り付けて送信してください')
    }
  }

  const draftOrders     = orders.filter(o => o.status === 'draft')
  const sentOrders      = orders.filter(o => o.status === 'sent')
  const deliveredOrders = orders.filter(o => o.status === 'delivered')
  const cancelledOrders = orders.filter(o => o.status === 'cancelled')
  const [showHistory, setShowHistory] = useState(false)

  // 今月の発注総額（納品済み+送付済み）
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthTotal = orders
    .filter(o => o.order_date.startsWith(thisMonth) && ['sent', 'delivered'].includes(o.status))
    .reduce((s, o) => s + (o.total_amount ?? 0), 0)

  return (
    <>
      {/* トースト */}
      {message && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow z-50 text-sm whitespace-nowrap">
          {message}
        </div>
      )}

      {/* サマリー */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400">送付待ち</p>
          <p className="text-2xl font-bold text-orange-500">{draftOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400">未確認</p>
          <p className="text-2xl font-bold text-blue-500">{sentOrders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400">今月発注額</p>
          <p className="text-lg font-bold text-gray-700">¥{monthTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* 新規発注ボタン */}
      <div className="mx-4 mt-4">
        <button onClick={() => setShowNewOrder(!showNewOrder)}
          className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm">
          {showNewOrder ? '▲ 閉じる' : '＋ 新しい発注を作る'}
        </button>

        {showNewOrder && (
          <div className="bg-white rounded-xl shadow-sm mt-2 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">取引先</label>
              <select value={newSupplierId} onChange={e => setNewSupplierId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">配達希望日</label>
              <input type="date" value={newDeliveryDate} onChange={e => setNewDeliveryDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-gray-500">発注品目</label>
                <button onClick={() => setNewItems(p => [...p, { name: '', quantity: '', unit: 'kg' }])}
                  className="text-xs bg-gray-100 px-2 py-1 rounded">＋追加</button>
              </div>
              {newItems.map((it, i) => (
                <div key={i} className="flex gap-1 mb-1">
                  <input type="text" placeholder="商品名" value={it.name}
                    onChange={e => setNewItems(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="flex-1 border rounded-lg px-2 py-2 text-sm" />
                  <input type="number" inputMode="decimal" placeholder="数" value={it.quantity}
                    onChange={e => setNewItems(p => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))}
                    className="w-14 border rounded-lg px-2 py-2 text-sm text-center" />
                  <select value={it.unit}
                    onChange={e => setNewItems(p => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                    className="w-14 border rounded-lg px-1 text-sm bg-white">
                    {['kg','g','個','本','袋','箱','L','ml'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  {newItems.length > 1 && (
                    <button onClick={() => setNewItems(p => p.filter((_, j) => j !== i))}
                      className="px-2 text-red-400 text-lg">×</button>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">備考（任意）</label>
              <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="配達時間の希望など" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={submitNewOrder} disabled={submittingNew}
              className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              {submittingNew ? '作成中...' : '発注を作成する'}
            </button>
          </div>
        )}
      </div>

      {/* 送付待ち */}
      {draftOrders.length > 0 && (
        <div className="mx-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">📤 送付待ち ({draftOrders.length}件)</h2>
          <div className="space-y-2">
            {draftOrders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-300">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">{order.supplier_name}</p>
                    <p className="text-xs text-gray-400">
                      {order.order_date}{order.delivery_date && ` → 配達希望: ${order.delivery_date}`}
                    </p>
                  </div>
                  {order.total_amount != null && (
                    <p className="text-sm font-bold text-gray-700">¥{order.total_amount.toLocaleString()}</p>
                  )}
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mb-3">
                  {order.items.map((it, i) => (
                    <span key={i} className="mr-2">・{it.name} {it.quantity}{it.unit}</span>
                  ))}
                </div>
                {order.note && <p className="text-xs text-gray-400 mb-2">📝 {order.note}</p>}
                <div className="flex gap-2">
                  <button onClick={() => sendOrder(order.id)}
                    className="flex-1 bg-green-500 text-white text-sm font-bold py-2 rounded-lg">
                    📤 送付メッセージを作る
                  </button>
                  <button onClick={() => updateStatus(order.id, 'cancelled')}
                    className="px-3 border border-gray-200 text-gray-400 text-sm rounded-lg">
                    取消
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 送付済み（確認待ち） */}
      {sentOrders.length > 0 && (
        <div className="mx-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">📦 確認待ち ({sentOrders.length}件)</h2>
          <div className="space-y-2">
            {sentOrders.map(order => (
              <div key={order.id}
                className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${order.alert_sent_at ? 'border-red-400' : 'border-blue-300'}`}>
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-800">{order.supplier_name}</p>
                      {order.alert_sent_at && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠️ 2h未確認</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {order.order_date}{order.delivery_date && ` → ${order.delivery_date}`}
                    </p>
                  </div>
                  {order.total_amount != null && (
                    <p className="text-sm font-bold text-gray-700">¥{order.total_amount.toLocaleString()}</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {order.items.map(it => `${it.name} ${it.quantity}${it.unit}`).join(' / ')}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => updateStatus(order.id, 'delivered')}
                    className="flex-1 bg-green-500 text-white text-sm font-bold py-2 rounded-lg">
                    ✅ 納品済みにする
                  </button>
                  <button onClick={() => sendOrder(order.id)}
                    className="px-3 border border-gray-200 text-gray-500 text-sm rounded-lg">
                    再送
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 履歴（納品済み・キャンセル） */}
      {(deliveredOrders.length > 0 || cancelledOrders.length > 0) && (
        <div className="mx-4 mt-4">
          <button onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-400 font-semibold">
            {showHistory ? '▲' : '▼'} 完了済み履歴 ({deliveredOrders.length + cancelledOrders.length}件)
          </button>
          {showHistory && (
            <div className="mt-2 bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {[...deliveredOrders, ...cancelledOrders].map(order => {
                const label = STATUS_LABEL[order.status]
                return (
                  <div key={order.id} className="p-3 opacity-70">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{order.supplier_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${label.color}`}>{label.text}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.order_date} / {order.items.length}品目
                      {order.total_amount != null && ` / ¥${order.total_amount.toLocaleString()}`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 取引先管理 */}
      <div className="mx-4 mt-4 bg-white rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-gray-600">🏪 取引先一覧 ({suppliers.length}件)</h2>
          <button onClick={() => setShowSupplierForm(!showSupplierForm)}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded">
            {showSupplierForm ? '閉じる' : '＋登録'}
          </button>
        </div>
        {showSupplierForm && (
          <div className="space-y-3 mb-3 pb-3 border-b">
            {/* 業者名 */}
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">業者名 <span className="text-red-400">*</span></label>
              <input type="text" placeholder="例：○○食品" value={newSupName} onChange={e => setNewSupName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {/* 連絡方法 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">連絡方法</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['line', 'email', 'both'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setNewSupContactMethod(m)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      newSupContactMethod === m
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {m === 'line' ? '💬 LINE' : m === 'email' ? '📧 メール' : '両方'}
                  </button>
                ))}
              </div>
            </div>

            {/* LINE ID / 電話番号（LINE・両方の場合） */}
            {(newSupContactMethod === 'line' || newSupContactMethod === 'both') && (
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">LINE ID / 電話番号</label>
                <input type="text" placeholder="例：@supplier123 / 06-XXXX-XXXX" value={newSupContact}
                  onChange={e => setNewSupContact(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}

            {/* メールアドレス（メール・両方の場合） */}
            {(newSupContactMethod === 'email' || newSupContactMethod === 'both') && (
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">メールアドレス <span className="text-red-400">*</span></label>
                <input type="email" placeholder="例：contact@supplier.co.jp" value={newSupEmail}
                  onChange={e => setNewSupEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-[10px] text-green-600 mt-0.5">✉️ 発注時にメールが自動送信されます</p>
              </div>
            )}

            <button onClick={addSupplier}
              className="w-full bg-blue-500 text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-50"
              disabled={!newSupName.trim() || ((newSupContactMethod === 'email' || newSupContactMethod === 'both') && !newSupEmail.trim())}>
              追加する
            </button>
          </div>
        )}

        {suppliers.length === 0 ? (
          <p className="text-xs text-gray-400">まだ取引先がありません</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {suppliers.map((s: Supplier) => (
              <div key={s.id} className="flex justify-between items-center py-2.5">
                <div>
                  <span className="text-sm font-medium text-gray-700">{s.name}</span>
                  <div className="flex gap-1 mt-0.5">
                    {(s.contact_type === 'line' || s.contact_type === 'both') && s.contact_value && (
                      <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">💬 LINE</span>
                    )}
                    {(s.contact_type === 'email' || s.contact_type === 'both') && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">📧 メール</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 truncate max-w-[120px]">{s.contact_value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 発注メッセージモーダル */}
      {sendText && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => { setSendText(null); setSendResult(null) }}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800">📤 発注メッセージ</h3>
                {sendResult?.email_sent ? (
                  <p className="text-xs text-green-600 font-semibold mt-0.5">
                    ✅ {sendResult.supplier_email} へ自動送信しました
                  </p>
                ) : sendResult?.email_error ? (
                  <p className="text-xs text-red-500 mt-0.5">
                    ⚠️ メール未送信: {sendResult.email_error}
                  </p>
                ) : sendResult?.supplier_email && sendResult.contact_method !== 'line' ? (
                  <p className="text-xs text-red-500 mt-0.5">
                    ⚠️ メール送信失敗 — 下記をコピーして送ってください
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">
                    コピーして業者さんに送ってください（LINE・メール・電話いずれでもOK）
                  </p>
                )}
              </div>
              <button onClick={() => { setSendText(null); setSendResult(null) }} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="p-4">
              <pre className="bg-gray-50 rounded-xl p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed">{sendText}</pre>
            </div>
            <div className="p-4 border-t flex flex-col gap-2">
              {/* 送信エラー表示 */}
              {sendResult?.email_error && !sendResult?.email_sent && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  ⚠️ {sendResult.email_error}
                </p>
              )}

              {!sendResult?.email_sent && (
                <div className="flex gap-2">
                  {/* 業者にメールアドレスが登録されている場合のみ表示 */}
                  {sendResult?.supplier_email && (
                    <button
                      onClick={() => sendEmailNow()}
                      disabled={emailSending}
                      className="flex-1 bg-green-500 disabled:bg-green-300 text-white font-bold py-3 rounded-xl text-sm">
                      {emailSending ? '送信中...' : '📧 業者に送る'}
                    </button>
                  )}
                  {/* テスト送付は常に表示（メアド未登録でも試せる） */}
                  <button
                    onClick={sendTestEmail}
                    disabled={emailSending}
                    className={`${sendResult?.supplier_email ? 'px-4' : 'flex-1'} bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm`}>
                    {emailSending ? '送信中...' : '🧪 テスト送付'}
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                {!sendResult?.email_sent && (
                  <button onClick={copyToClipboard}
                    className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl">
                    📋 コピーする
                  </button>
                )}
                <button onClick={() => { setSendText(null); setSendResult(null); setSendingOrderId(null) }}
                  className={`${sendResult?.email_sent ? 'flex-1 bg-green-500 text-white' : 'px-4 bg-gray-100 text-gray-600'} font-bold py-3 rounded-xl`}>
                  {sendResult?.email_sent ? '✅ 閉じる' : '閉じる'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
