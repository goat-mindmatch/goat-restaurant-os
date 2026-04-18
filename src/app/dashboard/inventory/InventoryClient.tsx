'use client'

import { useState } from 'react'

type InventoryItem = {
  id: string
  name: string
  category: string
  unit: string
  current_stock: number
  min_stock: number
  note: string | null
  last_updated: string
  supplier: { name: string } | null
}

type Supplier = { id: string; name: string }

const CATEGORY_LABELS: Record<string, string> = {
  food:        '🍜 食材',
  drink:       '🥤 飲料',
  consumable:  '🧴 消耗品',
  other:       '📦 その他',
}
const CATEGORY_ORDER = ['food', 'drink', 'consumable', 'other']

const UNITS = ['kg', 'g', '本', '個', '袋', '箱', 'L', 'ml', '枚', '缶']

export default function InventoryClient({
  items: initialItems,
  suppliers,
}: {
  items: InventoryItem[]
  suppliers: Supplier[]
}) {
  const [items, setItems] = useState(initialItems)
  const [showAddForm, setShowAddForm] = useState(false)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState<'receive' | 'use' | 'adjustment'>('receive')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 新規追加フォーム
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('food')
  const [newUnit, setNewUnit] = useState('kg')
  const [newStock, setNewStock] = useState('')
  const [newMin, setNewMin] = useState('')
  const [newSupplierId, setNewSupplierId] = useState('')

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  const handleAdd = async () => {
    if (!newName.trim()) return toast('❌ 品目名を入力してください')
    setLoading(true)
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName, category: newCategory, unit: newUnit,
        current_stock: newStock, min_stock: newMin,
        supplier_id: newSupplierId || null,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems(prev => [...prev, data.item])
      setNewName(''); setNewStock(''); setNewMin(''); setNewSupplierId('')
      setShowAddForm(false)
      toast('✅ 品目を追加しました')
    } else {
      toast('❌ ' + data.error)
    }
    setLoading(false)
  }

  const handleAdjust = async () => {
    if (!adjustItem || !adjustAmount) return
    const change = adjustReason === 'use'
      ? -Math.abs(Number(adjustAmount))
      : Math.abs(Number(adjustAmount))
    setLoading(true)
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: adjustItem.id, change_amount: change, reason: adjustReason }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems(prev => prev.map(i =>
        i.id === adjustItem.id ? { ...i, current_stock: data.new_stock } : i
      ))
      if (data.alert) toast(`⚠️ 在庫アラート！「${adjustItem.name}」が残り少なくなっています`)
      else toast('✅ 在庫を更新しました')
      setAdjustItem(null); setAdjustAmount('')
    } else {
      toast('❌ ' + data.error)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await fetch(`/api/inventory?item_id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    toast('🗑 削除しました')
  }

  // カテゴリ別グループ化
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: items.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const lowStockItems = items.filter(i => i.current_stock <= i.min_stock && i.min_stock > 0)

  return (
    <div className="pb-4">
      {msg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow ${
          msg.startsWith('❌') ? 'bg-red-500' : msg.startsWith('⚠️') ? 'bg-orange-500' : 'bg-gray-900'
        }`}>
          {msg}
        </div>
      )}

      {/* 要発注アラート */}
      {lowStockItems.length > 0 && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 mb-2">⚠️ 在庫不足 — 発注が必要です</p>
          {lowStockItems.map(i => (
            <div key={i.id} className="flex justify-between text-sm py-0.5">
              <span className="text-red-800">{i.name}</span>
              <span className="text-red-600 font-semibold">
                残 {i.current_stock}{i.unit} / 目安 {i.min_stock}{i.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 追加ボタン */}
      <div className="mx-4 mt-4">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm"
        >
          {showAddForm ? '▲ 閉じる' : '＋ 品目を追加する'}
        </button>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm mt-2 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500">品目名 *</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="例: 中華麺" className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">カテゴリ</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 bg-white">
                  {CATEGORY_ORDER.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">単位</label>
                <select value={newUnit} onChange={e => setNewUnit(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 bg-white">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">現在の在庫</label>
                <input type="number" inputMode="decimal" value={newStock} onChange={e => setNewStock(e.target.value)}
                  placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">発注目安（残量）</label>
                <input type="number" inputMode="decimal" value={newMin} onChange={e => setNewMin(e.target.value)}
                  placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
            </div>
            {suppliers.length > 0 && (
              <div>
                <label className="text-xs text-gray-500">取引先（任意）</label>
                <select value={newSupplierId} onChange={e => setNewSupplierId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5 bg-white">
                  <option value="">未選択</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={handleAdd} disabled={loading}
              className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              {loading ? '追加中...' : '追加する'}
            </button>
          </div>
        )}
      </div>

      {/* カテゴリ別一覧 */}
      <div className="mx-4 mt-4 space-y-4">
        {grouped.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
            <p className="text-3xl mb-2">📦</p>
            <p>在庫品目がありません</p>
            <p className="text-xs mt-1">「品目を追加する」から登録してください</p>
          </div>
        ) : grouped.map(({ cat, items: catItems }) => (
          <div key={cat}>
            <h2 className="text-xs font-bold text-gray-500 mb-2">{CATEGORY_LABELS[cat]}</h2>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {catItems.map(item => {
                const isLow = item.current_stock <= item.min_stock && item.min_stock > 0
                const stockPct = item.min_stock > 0
                  ? Math.min(100, Math.round((item.current_stock / (item.min_stock * 3)) * 100))
                  : 50
                return (
                  <div key={item.id} className={`p-4 ${isLow ? 'bg-red-50' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className={`font-semibold ${isLow ? 'text-red-800' : 'text-gray-800'}`}>
                          {isLow && '⚠️ '}{item.name}
                        </p>
                        {item.supplier && (
                          <p className="text-xs text-gray-400">仕入れ: {item.supplier.name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                          {item.current_stock}<span className="text-sm font-normal text-gray-500">{item.unit}</span>
                        </p>
                        {item.min_stock > 0 && (
                          <p className="text-xs text-gray-400">目安: {item.min_stock}{item.unit}</p>
                        )}
                      </div>
                    </div>

                    {/* 在庫バー */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                      <div
                        className={`h-1.5 rounded-full ${isLow ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>

                    {/* 操作ボタン */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAdjustItem(item); setAdjustReason('receive'); setAdjustAmount('') }}
                        className="flex-1 text-xs bg-green-100 text-green-700 font-semibold py-1.5 rounded-lg"
                      >
                        ＋ 入荷
                      </button>
                      <button
                        onClick={() => { setAdjustItem(item); setAdjustReason('use'); setAdjustAmount('') }}
                        className="flex-1 text-xs bg-orange-100 text-orange-700 font-semibold py-1.5 rounded-lg"
                      >
                        − 使用
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="px-3 text-xs text-gray-400 border border-gray-200 rounded-lg"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 在庫調整モーダル */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setAdjustItem(null)}>
          <div className="bg-white rounded-t-3xl w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1">
              {adjustReason === 'use' ? '− 使用量を記録' : '＋ 入荷を記録'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">{adjustItem.name}（現在: {adjustItem.current_stock}{adjustItem.unit}）</p>

            <div className="flex gap-2 mb-4">
              {(['receive', 'use', 'adjustment'] as const).map(r => (
                <button key={r} onClick={() => setAdjustReason(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                    adjustReason === r ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {r === 'receive' ? '入荷' : r === 'use' ? '使用' : '調整'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                inputMode="decimal"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                placeholder="数量"
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-center font-bold"
              />
              <span className="text-gray-500 font-medium">{adjustItem.unit}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAdjustItem(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 font-semibold">
                キャンセル
              </button>
              <button onClick={handleAdjust} disabled={!adjustAmount || loading}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50">
                {loading ? '更新中...' : '記録する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
