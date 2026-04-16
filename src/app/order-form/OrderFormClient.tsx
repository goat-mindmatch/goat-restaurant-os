'use client'

import { useState } from 'react'

type Item = { name: string; quantity: string; unit: string }

export default function OrderFormClient({
  staff, suppliers, lineUserId,
}: {
  staff: { id: string; name: string }
  suppliers: { id: string; name: string }[]
  lineUserId: string
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: '', unit: 'kg' }])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addItem = () => setItems(prev => [...prev, { name: '', quantity: '', unit: 'kg' }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, f: keyof Item, v: string) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [f]: v } : it))
  }

  const handleSubmit = async () => {
    if (!supplierId) {
      setError('取引先を選んでください')
      return
    }
    const valid = items.filter(it => it.name.trim() && it.quantity)
    if (valid.length === 0) {
      setError('商品を1つ以上入力してください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          items: valid.map(it => ({
            name: it.name,
            quantity: Number(it.quantity),
            unit: it.unit,
          })),
          delivery_date: deliveryDate,
          note: note || null,
          lineUserId,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSubmitted(true)
    } catch (e) {
      setError((e as Error).message)
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-gray-800 mb-1">発注依頼を送信しました</h2>
          <p className="text-sm text-gray-500">管理者が確認・送付します</p>
        </div>
      </div>
    )
  }

  if (suppliers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-gray-700 font-medium">取引先が登録されていません</p>
          <p className="text-xs text-gray-400 mt-2">管理者に取引先の登録を依頼してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white shadow-sm px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900">発注依頼</h1>
        <p className="text-sm text-gray-500">{staff.name}さん</p>
      </div>

      <div className="p-4 space-y-4">
        {/* 取引先選択 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-2 block">取引先</label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-base bg-white">
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* 配達希望日 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-2 block">配達希望日</label>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-base bg-white" />
        </div>

        {/* 品目 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs text-gray-500">発注品目</label>
            <button onClick={addItem}
              className="text-xs bg-gray-100 px-3 py-1 rounded">＋追加</button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-1">
                <input type="text" placeholder="商品名" value={it.name} onChange={e => updateItem(i, 'name', e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-2 text-sm" />
                <input type="number" inputMode="decimal" placeholder="数" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                  className="w-16 border rounded-lg px-2 py-2 text-sm text-center" />
                <select value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)}
                  className="w-16 border rounded-lg px-1 text-sm bg-white">
                  <option>kg</option>
                  <option>g</option>
                  <option>個</option>
                  <option>本</option>
                  <option>袋</option>
                  <option>箱</option>
                  <option>L</option>
                  <option>ml</option>
                </select>
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="px-2 text-red-400">×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 備考 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-xs text-gray-500 mb-2 block">備考（任意）</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="配達時間の希望など" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-base">
          {submitting ? '送信中...' : '発注依頼を送る'}
        </button>
      </div>
    </div>
  )
}
