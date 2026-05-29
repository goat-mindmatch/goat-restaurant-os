'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type ExpenseWithStaff = {
  id: string
  date: string
  category: string
  vendor: string | null
  amount: number
  note: string | null
  receipt_url: string | null
  ai_extracted: boolean
  staff: { name: string } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '食材費',
  fuel: 'ガソリン代',
  utility: '光熱費',
  consumable: '消耗品',
  equipment: '設備費',
  rent: '家賃',
  communication: '通信費',
  transport: '交通費',
  other: 'その他',
}

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700',
  fuel: 'bg-amber-100 text-amber-700',
  utility: 'bg-yellow-100 text-yellow-700',
  consumable: 'bg-green-100 text-green-700',
  equipment: 'bg-blue-100 text-blue-700',
  rent: 'bg-purple-100 text-purple-700',
  communication: 'bg-pink-100 text-pink-700',
  transport: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-600',
}

type Props = {
  expenses: ExpenseWithStaff[]
  staffStats: { id: string; name: string; count: number; total: number }[]
  month: string
  monthOptions: string[]
}

export default function ReceiptsClient({ expenses, staffStats, month, monthOptions }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<ExpenseWithStaff | null>(null)
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ category: '', vendor: '', note: '', amount: 0, date: '' })
  const [saving, setSaving] = useState(false)

  const onMonthChange = (m: string) => {
    router.push(`/dashboard/receipts?month=${m}`)
  }

  const openEdit = (exp: ExpenseWithStaff) => {
    setEditForm({
      category: exp.category,
      vendor: exp.vendor ?? '',
      note: exp.note ?? '',
      amount: exp.amount,
      date: exp.date,
    })
    setIsEditing(true)
  }

  const saveEdit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/expenses/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editForm.category,
          vendor:   editForm.vendor || null,
          note:     editForm.note || null,
          amount:   Number(editForm.amount),
          date:     editForm.date,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        alert(`保存失敗: ${j.error ?? res.status}`)
        return
      }
      setIsEditing(false)
      setSelected(null)
      router.refresh()
    } catch (e) {
      alert(`保存失敗: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const filtered = expenses.filter(e => {
    if (filterStaff !== 'all' && e.staff?.name !== filterStaff) return false
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    return true
  })

  const withImage = filtered.filter(e => e.receipt_url)
  const withoutImage = filtered.filter(e => !e.receipt_url)

  return (
    <div className="pb-28">
      {/* 月セレクタ */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500">📅 月</span>
        <select
          value={month}
          onChange={e => onMonthChange(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium bg-white"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{m.replace('-', '年') + '月'}</option>
          ))}
        </select>
      </div>

      {/* スタッフ別サマリー */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">👤 スタッフ別 送付枚数</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {staffStats.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">{month} のレシート提出なし</p>
          ) : (
            staffStats.map(s => (
              <button
                key={s.id}
                onClick={() => setFilterStaff(filterStaff === s.name ? 'all' : s.name)}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                  filterStaff === s.name ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                    {s.name.slice(0, 1)}
                  </div>
                  <span className="font-medium text-gray-800">{s.name}</span>
                  {filterStaff === s.name && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">絞込中</span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{s.count}枚</p>
                  <p className="text-xs text-gray-400">¥{s.total.toLocaleString()}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* フィルター */}
      <div className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCategory('all')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold ${
            filterCategory === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          すべて ({filtered.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => {
          const cnt = expenses.filter(e => e.category === k && (filterStaff === 'all' || e.staff?.name === filterStaff)).length
          if (cnt === 0) return null
          return (
            <button
              key={k}
              onClick={() => setFilterCategory(filterCategory === k ? 'all' : k)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold ${
                filterCategory === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {v} ({cnt})
            </button>
          )
        })}
      </div>

      {/* 表示切替 */}
      <div className="mx-4 mt-3 flex justify-between items-center">
        <p className="text-sm text-gray-500">{filtered.length}件</p>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 text-xs rounded-md font-semibold ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}
          >
            📷 画像
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs rounded-md font-semibold ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}
          >
            📋 リスト
          </button>
        </div>
      </div>

      {/* グリッド表示 */}
      {viewMode === 'grid' && (
        <div className="mx-4 mt-3">
          {withImage.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">画像あり ({withImage.length}件)</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {withImage.map(exp => (
                  <button
                    key={exp.id}
                    onClick={() => setSelected(exp)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:opacity-90"
                  >
                    <Image
                      src={exp.receipt_url!}
                      alt={exp.vendor ?? 'レシート'}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                      <p className="text-white text-[10px] font-semibold truncate">
                        ¥{exp.amount.toLocaleString()}
                      </p>
                      <p className="text-white/80 text-[9px] truncate">
                        {exp.staff?.name ?? '?'} · {exp.date.slice(5)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {withoutImage.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">画像なし（手動入力）({withoutImage.length}件)</p>
              <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
                {withoutImage.map(exp => (
                  <button
                    key={exp.id}
                    onClick={() => setSelected(exp)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{exp.vendor ?? '（業者名なし）'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.other}`}>
                          {CATEGORY_LABELS[exp.category] ?? exp.category}
                        </span>
                        <span className="text-[10px] text-gray-400">{exp.staff?.name ?? '不明'} · {exp.date.slice(5)}</span>
                      </div>
                    </div>
                    <p className="font-bold text-gray-900">¥{exp.amount.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">該当するレシートがありません</p>
          )}
        </div>
      )}

      {/* リスト表示 */}
      {viewMode === 'list' && (
        <div className="mx-4 mt-3 bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">該当するレシートがありません</p>
          ) : (
            filtered.map(exp => (
              <button
                key={exp.id}
                onClick={() => setSelected(exp)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  {exp.receipt_url ? (
                    <Image src={exp.receipt_url} alt="" width={48} height={48} className="w-full h-full object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📄</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">{exp.vendor ?? '（業者名なし）'}</p>
                    {exp.ai_extracted && (
                      <span className="text-[9px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded flex-shrink-0">AI</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.other}`}>
                      {CATEGORY_LABELS[exp.category] ?? exp.category}
                    </span>
                    <span className="text-[10px] text-gray-400">{exp.staff?.name ?? '不明'}</span>
                    <span className="text-[10px] text-gray-400">{exp.date}</span>
                  </div>
                  {exp.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{exp.note}</p>}
                </div>
                <p className="font-bold text-gray-900 flex-shrink-0">¥{exp.amount.toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* 詳細・編集モーダル */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => { setSelected(null); setIsEditing(false) }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {selected.receipt_url && (
              <div className="relative w-full aspect-[3/4] bg-gray-100">
                <Image
                  src={selected.receipt_url}
                  alt="レシート"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}

            <div className="p-4">
              {!isEditing ? (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{selected.vendor ?? '（業者名なし）'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS.other}`}>
                          {CATEGORY_LABELS[selected.category] ?? selected.category}
                        </span>
                        {selected.ai_extracted && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">AI自動抽出</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xl font-bold text-gray-900">¥{selected.amount.toLocaleString()}</p>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>日付</span><span className="font-medium text-gray-700">{selected.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>送付者</span><span className="font-medium text-gray-700">{selected.staff?.name ?? '不明'}</span>
                    </div>
                    {selected.note && (
                      <div className="flex justify-between">
                        <span>メモ</span><span className="font-medium text-gray-700">{selected.note}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => openEdit(selected)}
                      className="bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm"
                    >
                      ✏️ 編集
                    </button>
                    <button
                      onClick={() => { setSelected(null); setIsEditing(false) }}
                      className="bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm"
                    >
                      閉じる
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-bold text-gray-900 mb-3">編集</p>
                  <div className="space-y-3 text-sm">
                    <label className="block">
                      <span className="text-xs text-gray-500">カテゴリ</span>
                      <select
                        value={editForm.category}
                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 bg-white"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500">業者名</span>
                      <input
                        type="text"
                        value={editForm.vendor}
                        onChange={e => setEditForm({ ...editForm, vendor: e.target.value })}
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500">金額</span>
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500">日付</span>
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500">メモ</span>
                      <textarea
                        value={editForm.note}
                        onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2"
                        rows={2}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      className="bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
                    >
                      {saving ? '保存中...' : '💾 保存'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
