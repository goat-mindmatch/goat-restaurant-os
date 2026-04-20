'use client'

import { useState } from 'react'

type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  image_url: string | null
  sort_order: number
  is_available: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  main: '麺メニュー',
  topping: 'トッピング',
  side: 'サイドメニュー',
  drink: 'ドリンク',
  other: 'その他',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS)

export default function MenuManagementClient({ initialItems }: { initialItems: MenuItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 追加フォーム
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCategory, setNewCategory] = useState('main')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('')

  // 編集フォーム
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategory, setEditCategory] = useState('main')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editSortOrder, setEditSortOrder] = useState('')

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) return
    setLoading(true)
    const res = await fetch('/api/menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(), description: newDesc || null, price: Number(newPrice),
        category: newCategory, image_url: newImageUrl || null,
        sort_order: newSortOrder ? Number(newSortOrder) : 999,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setItems(prev => [...prev, data.item].sort((a, b) => a.sort_order - b.sort_order))
      setShowAdd(false)
      setNewName(''); setNewDesc(''); setNewPrice(''); setNewImageUrl(''); setNewSortOrder('')
      toast('✅ 商品を追加しました')
    } else {
      toast('❌ ' + (data.error ?? '追加に失敗しました'))
    }
  }

  const openEdit = (item: MenuItem) => {
    setEditId(item.id)
    setEditName(item.name); setEditDesc(item.description ?? ''); setEditPrice(String(item.price))
    setEditCategory(item.category); setEditImageUrl(item.image_url ?? ''); setEditSortOrder(String(item.sort_order))
  }

  const handleEdit = async (id: string) => {
    setLoading(true)
    const res = await fetch('/api/menu/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id, name: editName.trim(), description: editDesc || null, price: Number(editPrice),
        category: editCategory, image_url: editImageUrl || null,
        sort_order: editSortOrder ? Number(editSortOrder) : 999,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setItems(prev => prev.map(i => i.id === id ? {
        ...i, name: editName.trim(), description: editDesc || null, price: Number(editPrice),
        category: editCategory, image_url: editImageUrl || null, sort_order: Number(editSortOrder) || 999,
      } : i).sort((a, b) => a.sort_order - b.sort_order))
      setEditId(null)
      toast('✅ 更新しました')
    } else {
      toast('❌ ' + (data.error ?? '更新に失敗しました'))
    }
  }

  const handleToggle = async (item: MenuItem) => {
    const res = await fetch('/api/menu/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_available: !item.is_available }),
    })
    const data = await res.json()
    if (data.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
      toast(item.is_available ? `⛔ 「${item.name}」を販売停止にしました` : `✅ 「${item.name}」を販売再開しました`)
    }
  }

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`「${item.name}」を削除しますか？この操作は取り消せません。`)) return
    setLoading(true)
    await fetch(`/api/menu/items?id=${item.id}`, { method: 'DELETE' })
    setLoading(false)
    setItems(prev => prev.filter(i => i.id !== item.id))
    toast('🗑 削除しました')
  }

  const grouped = CATEGORIES
    .map(cat => ({ cat, items: items.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const addForm = (
    <div className="mx-4 mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-bold text-orange-800">新しい商品を追加</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-gray-500">商品名 *</label>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：まぜそば（並）"
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-xs text-gray-500">価格（円）*</label>
          <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="例：980"
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-xs text-gray-500">カテゴリ</label>
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5 bg-white">
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">説明（任意）</label>
          <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="例：コク深いタレに太麺"
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">写真URL（任意）</label>
          <input type="url" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="https://..."
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
          <p className="text-[10px] text-gray-400 mt-0.5">Google フォト / Cloudinary などの公開URLを貼り付けてください</p>
        </div>
        <div>
          <label className="text-xs text-gray-500">表示順（任意）</label>
          <input type="number" value={newSortOrder} onChange={e => setNewSortOrder(e.target.value)} placeholder="1, 2, 3..."
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
        </div>
      </div>
      {newImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={newImageUrl} alt="preview" className="w-full h-32 object-cover rounded-xl mt-1" onError={e => (e.currentTarget.style.display = 'none')} />
      )}
      <div className="flex gap-2">
        <button onClick={() => { setShowAdd(false); setNewName(''); setNewPrice(''); setNewImageUrl('') }}
          className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl text-sm">キャンセル</button>
        <button onClick={handleAdd} disabled={loading || !newName.trim() || !newPrice}
          className="flex-[2] bg-orange-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
          {loading ? '追加中...' : '✅ 追加する'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="py-4">
      {/* トースト */}
      {msg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl text-center">
          {msg}
        </div>
      )}

      {/* 統計 */}
      <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{items.filter(i => i.is_available).length}</p>
          <p className="text-xs text-gray-400">販売中</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-400">{items.filter(i => !i.is_available).length}</p>
          <p className="text-xs text-gray-400">停止中</p>
        </div>
      </div>

      {/* 追加ボタン */}
      {!showAdd && (
        <div className="mx-4 mb-4">
          <button onClick={() => setShowAdd(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-bold hover:bg-orange-50 transition-colors">
            ＋ 新しい商品を追加する
          </button>
        </div>
      )}

      {showAdd && addForm}

      {/* プレビューリンク */}
      <div className="mx-4 mb-4">
        <a href="/menu?table=1" target="_blank" rel="noopener noreferrer"
          className="block text-center text-xs text-blue-500 underline">
          📱 お客様向けメニューを確認する（テーブル1）
        </a>
      </div>

      {/* メニュー一覧（カテゴリ別） */}
      {grouped.length === 0 ? (
        <div className="mx-4 bg-white rounded-xl p-8 text-center text-gray-400 text-sm">
          商品がまだ登録されていません
        </div>
      ) : (
        grouped.map(({ cat, items: catItems }) => (
          <div key={cat} className="mx-4 mb-4">
            <h2 className="text-xs font-bold text-gray-500 mb-2 uppercase">{CATEGORY_LABELS[cat] ?? cat}</h2>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {catItems.map(item => (
                <div key={item.id} className={`${!item.is_available ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 p-3">
                    {/* 画像 */}
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🍜</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                        {!item.is_available && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded flex-shrink-0">停止中</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-400 truncate">{item.description}</p>
                      )}
                      <p className="text-sm font-bold text-orange-600 mt-0.5">¥{item.price.toLocaleString()}</p>
                    </div>

                    {/* アクションボタン */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => editId === item.id ? setEditId(null) : openEdit(item)}
                        className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-medium">
                        編集
                      </button>
                      <button onClick={() => handleToggle(item)}
                        className={`text-xs px-2 py-1 rounded-lg font-medium ${
                          item.is_available
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-green-50 text-green-600'
                        }`}>
                        {item.is_available ? '停止' : '再開'}
                      </button>
                    </div>
                  </div>

                  {/* 編集フォーム */}
                  {editId === item.id && (
                    <div className="border-t border-orange-100 bg-orange-50 p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">商品名</label>
                          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">価格</label>
                          <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">カテゴリ</label>
                          <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 bg-white">
                            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">説明</label>
                          <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500">写真URL</label>
                          <input type="url" value={editImageUrl} onChange={e => setEditImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">表示順</label>
                          <input type="number" value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                        </div>
                      </div>
                      {editImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={editImageUrl} alt="preview" className="w-full h-28 object-cover rounded-lg" onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => setEditId(null)} className="flex-1 bg-gray-100 text-gray-600 text-xs font-semibold py-2 rounded-lg">キャンセル</button>
                        <button onClick={() => handleEdit(item.id)} disabled={loading}
                          className="flex-[2] bg-orange-500 text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50">
                          {loading ? '保存中...' : '保存する'}
                        </button>
                        <button onClick={() => handleDelete(item)} className="bg-red-100 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg">削除</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
