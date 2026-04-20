'use client'

import { useState, useRef, useCallback } from 'react'

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
  main:    '麺メニュー',
  topping: 'トッピング',
  side:    'サイドメニュー',
  drink:   'ドリンク',
  other:   'その他',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS)

// ─── 画像アップロードガイド ───────────────────────────
const IMAGE_GUIDE = '推奨：正方形（1:1）、1000×1000px以上、5MB以内、JPG/PNG/WebP'

// ─── 画像アップロードボタン ───────────────────────────
function ImageUploader({
  currentUrl,
  onUpload,
}: {
  currentUrl: string
  onUpload: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/menu/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.ok) {
        onUpload(data.url)
      } else {
        setError(data.error ?? 'アップロードに失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-0.5">
        写真
        <span className="ml-1 text-[10px] text-orange-500 font-normal">({IMAGE_GUIDE})</span>
      </label>

      {/* 現在の画像プレビュー */}
      {currentUrl ? (
        <div className="relative mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt="preview"
            className="w-full h-36 object-cover rounded-xl bg-gray-100"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
          <button
            type="button"
            onClick={() => onUpload('')}
            className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-lg"
          >
            削除
          </button>
        </div>
      ) : (
        <div className="w-full h-20 bg-orange-50 border-2 border-dashed border-orange-200 rounded-xl flex items-center justify-center mb-2">
          <span className="text-gray-400 text-xs">写真なし</span>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border border-orange-300 text-orange-600 bg-orange-50 font-semibold py-2 rounded-xl text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {uploading ? (
          <>⏳ アップロード中...</>
        ) : (
          <>📷 {currentUrl ? '写真を変更する' : '写真をアップロードする'}</>
        )}
      </button>
      {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ─── ソートモード（並べ替えUI） ─────────────────────
function SortableList({
  items,
  onSave,
  onCancel,
}: {
  items: MenuItem[]
  onSave: (sorted: MenuItem[]) => void
  onCancel: () => void
}) {
  const [sorted, setSorted] = useState([...items])
  const [saving, setSaving] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  // デスクトップ: HTML5 drag-and-drop
  const handleDragStart = (idx: number) => { dragItem.current = idx }
  const handleDragEnter = (idx: number) => { dragOver.current = idx }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    const newList = [...sorted]
    const [moved] = newList.splice(dragItem.current, 1)
    newList.splice(dragOver.current, 0, moved)
    setSorted(newList)
    dragItem.current = null
    dragOver.current = null
  }

  // モバイル: ↑ ↓ ボタン
  const moveUp   = (i: number) => {
    if (i === 0) return
    const n = [...sorted]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setSorted(n)
  }
  const moveDown = (i: number) => {
    if (i === sorted.length - 1) return
    const n = [...sorted]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; setSorted(n)
  }

  const handleSave = async () => {
    setSaving(true)
    const orders = sorted.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }))
    await fetch('/api/menu/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    })
    setSaving(false)
    onSave(sorted.map((item, idx) => ({ ...item, sort_order: idx + 1 })))
  }

  return (
    <div className="mx-4 mb-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-800">
        💡 <b>長押し＆ドラッグ</b>で並べ替え（PC）/ 右の <b>↑↓ボタン</b>で並べ替え（スマホ）
      </div>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {sorted.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            className="flex items-center gap-3 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none"
          >
            <span className="text-gray-300 text-lg flex-shrink-0">⠿</span>
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🍜</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-400">¥{item.price.toLocaleString()} · {CATEGORY_LABELS[item.category] ?? item.category}</p>
            </div>
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold disabled:opacity-30 flex items-center justify-center"
              >▲</button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === sorted.length - 1}
                className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold disabled:opacity-30 flex items-center justify-center"
              >▼</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex-[2] bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50">
          {saving ? '保存中...' : '💾 この順番で保存する'}
        </button>
      </div>
    </div>
  )
}

// ─── メインコンポーネント ─────────────────────────────
export default function MenuManagementClient({ initialItems }: { initialItems: MenuItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 追加フォーム
  const [newName,      setNewName]      = useState('')
  const [newDesc,      setNewDesc]      = useState('')
  const [newPrice,     setNewPrice]     = useState('')
  const [newCategory,  setNewCategory]  = useState('main')
  const [newImageUrl,  setNewImageUrl]  = useState('')

  // 編集フォーム
  const [editName,     setEditName]     = useState('')
  const [editDesc,     setEditDesc]     = useState('')
  const [editPrice,    setEditPrice]    = useState('')
  const [editCategory, setEditCategory] = useState('main')
  const [editImageUrl, setEditImageUrl] = useState('')

  const toast = useCallback((m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 3500)
  }, [])

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) return
    setLoading(true)
    try {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1
      const res = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(), description: newDesc || null,
          price: Number(newPrice), category: newCategory,
          image_url: newImageUrl || null, sort_order: maxOrder,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setItems(prev => [...prev, data.item].sort((a, b) => a.sort_order - b.sort_order))
        setShowAdd(false)
        setNewName(''); setNewDesc(''); setNewPrice(''); setNewImageUrl(''); setNewCategory('main')
        toast('✅ 商品を追加しました')
      } else {
        toast('❌ ' + (data.error ?? '追加に失敗しました'))
      }
    } catch {
      toast('❌ 通信エラーが発生しました')
    }
    setLoading(false)
  }

  const openEdit = (item: MenuItem) => {
    setEditId(item.id)
    setEditName(item.name); setEditDesc(item.description ?? '')
    setEditPrice(String(item.price)); setEditCategory(item.category)
    setEditImageUrl(item.image_url ?? '')
  }

  const handleEdit = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/menu/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, name: editName.trim(), description: editDesc || null,
          price: Number(editPrice), category: editCategory,
          image_url: editImageUrl || null,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setItems(prev => prev.map(i => i.id === id ? {
          ...i, name: editName.trim(), description: editDesc || null,
          price: Number(editPrice), category: editCategory, image_url: editImageUrl || null,
        } : i))
        setEditId(null)
        toast('✅ 更新しました')
      } else {
        toast('❌ ' + (data.error ?? '更新に失敗しました'))
      }
    } catch {
      toast('❌ 通信エラーが発生しました')
    }
    setLoading(false)
  }

  const handleToggle = async (item: MenuItem) => {
    try {
      const res = await fetch('/api/menu/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_available: !item.is_available }),
      })
      const data = await res.json()
      if (data.ok) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
        toast(item.is_available ? `⛔ 「${item.name}」を販売停止` : `✅ 「${item.name}」を販売再開`)
      }
    } catch {
      toast('❌ 通信エラーが発生しました')
    }
  }

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`「${item.name}」を削除しますか？元に戻せません。`)) return
    setLoading(true)
    try {
      await fetch(`/api/menu/items?id=${item.id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.id !== item.id))
      setEditId(null)
      toast('🗑 削除しました')
    } catch {
      toast('❌ 削除に失敗しました')
    }
    setLoading(false)
  }

  const grouped = CATEGORIES
    .map(cat => ({ cat, items: items.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  // ─── 並び替えモード ──────────────────────────────
  if (sortMode) {
    return (
      <div className="py-4">
        <div className="mx-4 mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">表示順の並び替え</h2>
        </div>
        <SortableList
          items={items}
          onSave={(sorted) => { setItems(sorted); setSortMode(false); toast('✅ 表示順を保存しました') }}
          onCancel={() => setSortMode(false)}
        />
      </div>
    )
  }

  return (
    <div className="py-4">
      {/* トースト */}
      {msg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl text-center animate-fade-in">
          {msg}
        </div>
      )}

      {/* 統計 + 並び替えボタン */}
      <div className="mx-4 mb-4 grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xl font-bold text-gray-900">{items.filter(i => i.is_available).length}</p>
          <p className="text-[10px] text-gray-400">販売中</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xl font-bold text-gray-400">{items.filter(i => !i.is_available).length}</p>
          <p className="text-[10px] text-gray-400">停止中</p>
        </div>
        <button
          type="button"
          onClick={() => setSortMode(true)}
          className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"
        >
          <p className="text-xl">↕️</p>
          <p className="text-[10px] text-blue-600 font-semibold">並び替え</p>
        </button>
      </div>

      {/* 追加フォーム / ボタン */}
      {!showAdd ? (
        <div className="mx-4 mb-4">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-bold hover:bg-orange-50 transition-colors"
          >
            ＋ 新しい商品を追加する
          </button>
        </div>
      ) : (
        <div className="mx-4 mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-orange-800">新しい商品を追加</p>

          <div>
            <label className="text-xs text-gray-500">商品名 <span className="text-red-500">*</span></label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="例：まぜそば（並）"
              className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">価格（円）<span className="text-red-500">*</span></label>
              <input type="number" inputMode="numeric" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                placeholder="980"
                className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">カテゴリ</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5 bg-white">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">説明（任意）</label>
            <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="例：コク深いタレに太麺"
              className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm mt-0.5" />
          </div>

          <ImageUploader currentUrl={newImageUrl} onUpload={setNewImageUrl} />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewName(''); setNewDesc(''); setNewPrice(''); setNewImageUrl(''); setNewCategory('main') }}
              className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl text-sm"
            >キャンセル</button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={loading || !newName.trim() || !newPrice}
              className="flex-[2] bg-orange-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
            >{loading ? '追加中...' : '✅ 追加する'}</button>
          </div>
        </div>
      )}

      {/* プレビューリンク */}
      <div className="mx-4 mb-3 text-center">
        <a href="/menu?table=1" target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-500 underline">
          📱 お客様向けメニューを確認する（テーブル1）
        </a>
      </div>

      {/* メニュー一覧 */}
      {grouped.length === 0 ? (
        <div className="mx-4 bg-white rounded-xl p-8 text-center text-gray-400 text-sm">
          商品がまだ登録されていません
        </div>
      ) : (
        grouped.map(({ cat, items: catItems }) => (
          <div key={cat} className="mx-4 mb-4">
            <h2 className="text-xs font-bold text-gray-500 mb-2 tracking-wide">
              {CATEGORY_LABELS[cat] ?? cat}（{catItems.length}品）
            </h2>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {catItems.map(item => (
                <div key={item.id} className={`${!item.is_available ? 'opacity-50' : ''}`}>
                  {/* ─ 商品行 ─ */}
                  <div className="flex items-center gap-3 p-3">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🍜</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                        {!item.is_available && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded flex-shrink-0">停止中</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                      )}
                      <p className="text-sm font-bold text-orange-600 mt-0.5">¥{item.price.toLocaleString()}</p>
                    </div>

                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => editId === item.id ? setEditId(null) : openEdit(item)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${
                          editId === item.id ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'
                        }`}
                      >{editId === item.id ? '閉じる' : '編集'}</button>
                      <button
                        type="button"
                        onClick={() => handleToggle(item)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${
                          item.is_available ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-600'
                        }`}
                      >{item.is_available ? '停止' : '再開'}</button>
                    </div>
                  </div>

                  {/* ─ 編集フォーム ─ */}
                  {editId === item.id && (
                    <div className="border-t border-orange-100 bg-orange-50 p-4 space-y-3">

                      <div>
                        <label className="text-xs text-gray-500">商品名</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">価格（円）</label>
                          <input type="number" inputMode="numeric" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">カテゴリ</label>
                          <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm mt-0.5 bg-white">
                            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500">説明</label>
                        <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                          className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
                      </div>

                      <ImageUploader currentUrl={editImageUrl} onUpload={setEditImageUrl} />

                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setEditId(null)}
                          className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-2.5 rounded-xl">
                          キャンセル
                        </button>
                        <button type="button" onClick={() => handleEdit(item.id)} disabled={loading}
                          className="flex-[2] bg-orange-500 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                          {loading ? '保存中...' : '💾 保存する'}
                        </button>
                        <button type="button" onClick={() => handleDelete(item)}
                          className="bg-red-100 text-red-600 text-sm font-semibold px-3 py-2.5 rounded-xl">
                          🗑
                        </button>
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
