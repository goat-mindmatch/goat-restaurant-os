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
  supplier_email?: string | null
  order_quantity?: number | null
}

type Supplier = { id: string; name: string }

const CATEGORY_LABELS: Record<string, string> = {
  food:       '🍜 食材',
  drink:      '🥤 飲料',
  consumable: '🧴 消耗品',
  other:      '🗃️ その他',
}
const CATEGORY_ORDER = ['food', 'drink', 'consumable', 'other']

const UNITS = ['kg', 'g', '本', '個', '袋', '箱', 'L', 'ml', '枚', '缶']

// 在庫バーのパーセント計算（min_stock * 3 が100%）
function StockBar({ current, min, unit, isLow }: {
  current: number; min: number; unit: string; isLow: boolean
}) {
  const pct = min > 0 ? Math.min(100, Math.round((current / (min * 3)) * 100)) : 50
  const barColor = isLow ? 'bg-red-400' : pct > 66 ? 'bg-green-400' : 'bg-yellow-400'

  return (
    <div className="w-full">
      <div className="relative w-full bg-gray-100 rounded-full h-2 mb-0.5">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0{unit}</span>
        {min > 0 && <span className="text-orange-500">発注目安 {min}{unit}</span>}
        <span>{min > 0 ? min * 3 : '—'}{unit}</span>
      </div>
    </div>
  )
}

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

  // アコーディオン開閉状態（デフォルト: 在庫不足のあるカテゴリのみ展開）
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {}
    for (const cat of CATEGORY_ORDER) {
      const hasLow = initialItems.some(
        i => i.category === cat && i.current_stock <= i.min_stock && i.min_stock > 0
      )
      state[cat] = hasLow // 在庫不足あり → 展開
    }
    return state
  })

  // 発注モーダル（在庫→発注ワンフロー）
  const [orderItem, setOrderItem] = useState<InventoryItem | null>(null)
  const [orderSupplierId, setOrderSupplierId] = useState('')
  const [orderQty, setOrderQty] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)

  // 新規追加フォーム
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('food')
  const [newUnit, setNewUnit] = useState('kg')
  const [newStock, setNewStock] = useState('')
  const [newMin, setNewMin] = useState('')
  const [newSupplierId, setNewSupplierId] = useState('')

  // 自動発注設定モーダル
  const [autoOrderItem, setAutoOrderItem] = useState<InventoryItem | null>(null)
  const [autoOrderEmail, setAutoOrderEmail] = useState('')
  const [autoOrderQty, setAutoOrderQty] = useState('')
  const [autoOrderSaving, setAutoOrderSaving] = useState(false)

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const openAutoOrder = (item: InventoryItem) => {
    setAutoOrderItem(item)
    setAutoOrderEmail(item.supplier_email ?? '')
    setAutoOrderQty(String(item.order_quantity ?? (item.min_stock * 2 || '')))
  }

  const handleAutoOrderSave = async () => {
    if (!autoOrderItem) return
    setAutoOrderSaving(true)
    const res = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: autoOrderItem.id,
        change_amount: 0,
        reason: 'adjustment',
        supplier_email: autoOrderEmail || null,
        order_quantity: autoOrderQty ? Number(autoOrderQty) : null,
      }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i =>
        i.id === autoOrderItem.id
          ? { ...i, supplier_email: autoOrderEmail || null, order_quantity: autoOrderQty ? Number(autoOrderQty) : null }
          : i
      ))
      toast('✅ 自動発注設定を保存しました')
      setAutoOrderItem(null)
    } else {
      const d = await res.json()
      toast('❌ ' + (d.error ?? '保存に失敗しました'))
    }
    setAutoOrderSaving(false)
  }

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

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

  // 在庫→発注ワンフロー
  const openOrderFlow = (item: InventoryItem) => {
    setOrderItem(item)
    // デフォルト取引先を設定
    const matchedSupplier = item.supplier
      ? suppliers.find(s => s.name === item.supplier!.name)
      : null
    setOrderSupplierId(matchedSupplier?.id ?? suppliers[0]?.id ?? '')
    setOrderQty('')
  }

  const handleQuickOrder = async () => {
    if (!orderItem || !orderSupplierId) return
    const qty = Number(orderQty) || (orderItem.min_stock * 2)
    setOrderSubmitting(true)
    const res = await fetch('/api/orders/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier_id: orderSupplierId,
        delivery_date: (() => {
          const d = new Date(); d.setDate(d.getDate() + 1)
          return d.toISOString().split('T')[0]
        })(),
        items: [{ name: orderItem.name, quantity: qty, unit: orderItem.unit }],
        note: `在庫不足による自動発注：残${orderItem.current_stock}${orderItem.unit}`,
      }),
    })
    setOrderSubmitting(false)
    if (res.ok) {
      toast(`✅ 「${orderItem.name}」を${qty}${orderItem.unit}発注しました`)
      setOrderItem(null)
    } else {
      toast('❌ 発注に失敗しました。発注ページから手動で入力してください。')
    }
  }

  // カテゴリ別グループ化
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: items.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const lowStockItems = items.filter(i => i.current_stock <= i.min_stock && i.min_stock > 0)

  return (
    <div className="pb-4">
      {/* トーストメッセージ */}
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
          <div className="space-y-2">
            {lowStockItems.map(i => (
              <div key={i.id} className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-red-800 font-semibold">{i.name}</span>
                  <span className="text-xs text-red-500 ml-2">
                    残 {i.current_stock}{i.unit} / 目安 {i.min_stock}{i.unit}
                  </span>
                </div>
                <button
                  onClick={() => openOrderFlow(i)}
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold"
                >
                  発注する →
                </button>
              </div>
            ))}
          </div>
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
                <input type="number" inputMode="decimal" value={newStock}
                  onChange={e => setNewStock(e.target.value)}
                  placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">発注目安（残量）</label>
                <input type="number" inputMode="decimal" value={newMin}
                  onChange={e => setNewMin(e.target.value)}
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

      {/* カテゴリ別アコーディオン一覧 */}
      <div className="mx-4 mt-4 space-y-3">
        {grouped.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
            <p className="text-3xl mb-2">🗃️</p>
            <p>在庫品目がありません</p>
            <p className="text-xs mt-1">「品目を追加する」から登録してください</p>
          </div>
        ) : grouped.map(({ cat, items: catItems }) => {
          const catLowCount = catItems.filter(
            i => i.current_stock <= i.min_stock && i.min_stock > 0
          ).length
          const isOpen = openCategories[cat] ?? false
          return (
            <div key={cat} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* カテゴリヘッダー（タップで展開） */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700 text-sm">{CATEGORY_LABELS[cat]}</span>
                  <span className="text-xs text-gray-400">{catItems.length}品目</span>
                  {catLowCount > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                      ⚠️ 不足{catLowCount}
                    </span>
                  )}
                </div>
                <span className="text-gray-300 text-lg">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* 品目リスト */}
              {isOpen && (
                <div className="divide-y divide-gray-100">
                  {catItems.map(item => {
                    const isLow = item.current_stock <= item.min_stock && item.min_stock > 0
                    return (
                      <div key={item.id} className={`p-4 ${isLow ? 'bg-red-50' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className={`font-semibold text-sm ${isLow ? 'text-red-800' : 'text-gray-800'}`}>
                              {isLow && '⚠️ '}{item.name}
                            </p>
                            {item.supplier && (
                              <p className="text-xs text-gray-400">仕入れ: {item.supplier.name}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.current_stock}
                              <span className="text-sm font-normal text-gray-500">{item.unit}</span>
                            </p>
                          </div>
                        </div>

                        {/* 在庫バー（数値ラベル付き） */}
                        <div className="mb-3">
                          <StockBar
                            current={item.current_stock}
                            min={item.min_stock}
                            unit={item.unit}
                            isLow={isLow}
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
                          {isLow && (
                            <button
                              onClick={() => openOrderFlow(item)}
                              className="flex-1 text-xs bg-red-500 text-white font-bold py-1.5 rounded-lg"
                            >
                              発注 →
                            </button>
                          )}
                          <button
                            onClick={() => openAutoOrder(item)}
                            className={`px-2 text-xs font-semibold rounded-lg py-1.5 ${
                              item.supplier_email
                                ? 'bg-purple-100 text-purple-700'
                                : 'border border-gray-200 text-gray-400'
                            }`}
                            title="自動発注設定"
                          >
                            ⚡
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
              )}
            </div>
          )
        })}
      </div>

      {/* 在庫調整モーダル */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setAdjustItem(null)}>
          <div className="bg-white rounded-t-3xl w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1">
              {adjustReason === 'use' ? '− 使用量を記録' : '＋ 入荷を記録'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {adjustItem.name}（現在: {adjustItem.current_stock}{adjustItem.unit}）
            </p>

            <div className="flex gap-2 mb-4">
              {(['receive', 'use', 'adjustment'] as const).map(r => (
                <button key={r} onClick={() => setAdjustReason(r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                    adjustReason === r
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-600 border-gray-200'
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

      {/* 自動発注設定モーダル */}
      {autoOrderItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setAutoOrderItem(null)}>
          <div className="bg-white rounded-t-3xl w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1">⚡ 自動発注設定</h3>
            <p className="text-sm text-gray-500 mb-4">{autoOrderItem.name}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  発注先メールアドレス（在庫不足時に自動送信）
                </label>
                <input
                  type="email"
                  value={autoOrderEmail}
                  onChange={e => setAutoOrderEmail(e.target.value)}
                  placeholder="supplier@example.com"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  自動発注数量（空欄 = 最低在庫数の2倍）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={autoOrderQty}
                    onChange={e => setAutoOrderQty(e.target.value)}
                    placeholder={String(autoOrderItem.min_stock * 2 || '')}
                    className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-center font-bold"
                  />
                  <span className="text-gray-500 font-medium">{autoOrderItem.unit}</span>
                </div>
              </div>

              {autoOrderItem.supplier_email && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700">
                  現在の設定: {autoOrderItem.supplier_email}
                  {autoOrderItem.order_quantity && ` / 発注量: ${autoOrderItem.order_quantity}${autoOrderItem.unit}`}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setAutoOrderItem(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 font-semibold">
                キャンセル
              </button>
              <button onClick={handleAutoOrderSave} disabled={autoOrderSaving}
                className="flex-[2] py-3 bg-purple-600 text-white rounded-xl font-bold disabled:opacity-50">
                {autoOrderSaving ? '保存中...' : '⚡ 自動発注を設定する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 発注ワンフローモーダル */}
      {orderItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setOrderItem(null)}>
          <div className="bg-white rounded-t-3xl w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-1">📦 発注する</h3>
            <p className="text-sm text-gray-500 mb-4">
              {orderItem.name} — 現在の在庫: {orderItem.current_stock}{orderItem.unit}
            </p>

            {suppliers.length > 0 ? (
              <>
                <div className="mb-3">
                  <label className="text-xs text-gray-500 mb-1 block">取引先</label>
                  <select value={orderSupplierId} onChange={e => setOrderSupplierId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2.5 bg-white text-sm">
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-500 mb-1 block">発注数量</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={orderQty}
                      onChange={e => setOrderQty(e.target.value)}
                      placeholder={`例: ${orderItem.min_stock * 2}`}
                      className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-center font-bold"
                    />
                    <span className="text-gray-500 font-medium">{orderItem.unit}</span>
                  </div>
                  {orderItem.min_stock > 0 && (
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      推奨: {orderItem.min_stock * 2}{orderItem.unit}（目安の2倍）
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setOrderItem(null)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-500 font-semibold">
                    キャンセル
                  </button>
                  <button onClick={handleQuickOrder} disabled={orderSubmitting}
                    className="flex-[2] py-3 bg-red-500 text-white rounded-xl font-bold disabled:opacity-50">
                    {orderSubmitting ? '発注中...' : '発注を確定する'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">
                  取引先が登録されていません。発注ページから登録してください。
                </p>
                <a href="/dashboard/orders"
                  className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm">
                  発注ページへ →
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
