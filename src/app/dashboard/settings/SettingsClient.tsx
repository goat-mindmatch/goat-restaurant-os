'use client'

/**
 * 設定クライアント
 * タブ切り替え: 店舗設定 / スタッフ管理 / LINE設定
 */

import { useState, useEffect, useCallback } from 'react'

type Tab = 'store' | 'staff' | 'costs' | 'line'

type Staff = {
  id: string
  name: string
  role: string
  hourly_wage: number
  transport_fee: number | null
  is_active: boolean
}

// ─── トースト ────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
      type === 'success'
        ? 'bg-green-50 text-green-800 border border-green-200'
        : 'bg-red-50 text-red-800 border border-red-200'
    }`}>
      {msg}
    </div>
  )
}

// ─── 店舗設定タブ ────────────────────────────────────
function StoreTab() {
  const [name, setName]           = useState('')
  const [target, setTarget]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/settings/tenant')
      .then(r => r.json())
      .then((d: { name?: string; monthly_target?: number }) => {
        setName(d.name ?? '')
        setTarget(String(d.monthly_target ?? 0))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/settings/tenant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, monthly_target: Number(target) }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) setToast({ msg: '✅ 保存しました', type: 'success' })
      else       setToast({ msg: `❌ ${d.error ?? '保存に失敗しました'}`, type: 'error' })
    } catch {
      setToast({ msg: '❌ 保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">店舗名</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="例：人類みなまぜそば"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">月間売上目標（円）</label>
        <input
          type="number"
          value={target}
          onChange={e => setTarget(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="例：3000000"
          min={0}
          step={100000}
        />
        {Number(target) > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            ≈ 月 {(Number(target) / 10000).toFixed(0)}万円 ／ 日平均 {Math.round(Number(target) / 30).toLocaleString()}円
          </p>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {saving ? '保存中...' : '💾 保存する'}
      </button>
    </div>
  )
}

// ─── スタッフ管理タブ ────────────────────────────────
function StaffTab() {
  const [list, setList]           = useState<Staff[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)

  // 新規追加フォーム
  const [newName, setNewName]         = useState('')
  const [newRole, setNewRole]         = useState<'staff' | 'manager'>('staff')
  const [newWage, setNewWage]         = useState('1100')
  const [newTransport, setNewTransport] = useState('0')
  const [adding, setAdding]           = useState(false)

  // 編集フォーム
  const [editWage, setEditWage]       = useState('')
  const [editTransport, setEditTransport] = useState('')
  const [saving, setSaving]           = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/staff')
      .then(r => r.json())
      .then((d: Staff[]) => { setList(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const addStaff = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          role: newRole,
          hourly_wage: Number(newWage),
          transport_fee: Number(newTransport),
        }),
      })
      const d = await res.json() as { id?: string; error?: string }
      if (d.id) {
        showToast(`✅ ${newName} を追加しました`, 'success')
        setNewName(''); setNewWage('1100'); setNewTransport('0'); setNewRole('staff')
        setShowAdd(false)
        load()
      } else {
        showToast(`❌ ${d.error ?? '追加に失敗しました'}`, 'error')
      }
    } catch {
      showToast('❌ 追加に失敗しました', 'error')
    } finally {
      setAdding(false)
    }
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourly_wage: Number(editWage), transport_fee: Number(editTransport) }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) {
        showToast('✅ 更新しました', 'success')
        setEditId(null)
        load()
      } else {
        showToast(`❌ ${d.error ?? '更新に失敗しました'}`, 'error')
      }
    } catch {
      showToast('❌ 更新に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s: Staff) => {
    try {
      const res = await fetch(`/api/staff/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      })
      const d = await res.json() as { ok?: boolean }
      if (d.ok) {
        showToast(s.is_active ? `🔴 ${s.name} を無効にしました` : `🟢 ${s.name} を有効にしました`, 'success')
        load()
      }
    } catch { /* ignore */ }
  }

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>

  const active   = list.filter(s => s.is_active)
  const inactive = list.filter(s => !s.is_active)

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* スタッフ追加ボタン */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full mb-4 py-2.5 rounded-xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-semibold hover:bg-orange-50 transition-colors"
      >
        {showAdd ? '✕ キャンセル' : '＋ スタッフを追加する'}
      </button>

      {/* 追加フォーム */}
      {showAdd && (
        <div className="mb-4 bg-orange-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-orange-700">新しいスタッフ</p>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="名前（例：田中 花子）"
            className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">時給（円）</label>
              <input
                type="number"
                value={newWage}
                onChange={e => setNewWage(e.target.value)}
                className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">交通費（円/日）</label>
              <input
                type="number"
                value={newTransport}
                onChange={e => setNewTransport(e.target.value)}
                className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">役職</label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as 'staff' | 'manager')}
              className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
            >
              <option value="staff">スタッフ</option>
              <option value="manager">マネージャー</option>
            </select>
          </div>
          <button
            onClick={addStaff}
            disabled={adding || !newName.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {adding ? '追加中...' : '追加する'}
          </button>
        </div>
      )}

      {/* 在籍スタッフ */}
      <div className="space-y-2 mb-4">
        {active.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
              onClick={() => {
                if (editId === s.id) { setEditId(null) }
                else { setEditId(s.id); setEditWage(String(s.hourly_wage)); setEditTransport(String(s.transport_fee ?? 0)) }
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.role === 'manager' ? '👑' : '👤'}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">時給 ¥{s.hourly_wage.toLocaleString()} ／ 交通費 ¥{(s.transport_fee ?? 0).toLocaleString()}/日</p>
                </div>
              </div>
              <span className="text-gray-300 text-xs">{editId === s.id ? '▲' : '▼'}</span>
            </div>

            {editId === s.id && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">時給（円）</label>
                    <input
                      type="number"
                      value={editWage}
                      onChange={e => setEditWage(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">交通費（円/日）</label>
                    <input
                      type="number"
                      value={editTransport}
                      onChange={e => setEditTransport(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(s.id)}
                    disabled={saving}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    className="px-3 py-2 bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                  >
                    退職
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 退職済みスタッフ */}
      {inactive.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">退職済み（{inactive.length}名）</summary>
          <div className="mt-2 space-y-2">
            {inactive.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 opacity-60">
                <p className="text-sm text-gray-500">{s.name}</p>
                <button
                  onClick={() => toggleActive(s)}
                  className="text-xs text-orange-500 hover:underline"
                >
                  復帰
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

type MenuStatus = {
  id: string
  name: string
  is_default: boolean
  has_image: boolean
  image_content_type: string | null
}

// ─── 固定費管理タブ ──────────────────────────────────

const FIXED_COST_CATEGORIES: Record<string, string> = {
  rent: '家賃',
  utility: '光熱費',
  communication: '通信費',
  equipment: '設備リース',
  insurance: '保険',
  other: 'その他固定費',
}

function FixedCostsTab() {
  type FixedCost = { id: string; category: string; amount: number; name: string | null; is_active: boolean }
  const [list, setList] = useState<FixedCost[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('rent')
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const showMsg = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const [tableReady, setTableReady] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/settings/fixed-costs')
      .then(r => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) {
          setList(d as FixedCost[])
          setTableReady(true)
        } else {
          // テーブルが存在しない or APIエラー → 空リストで表示
          setList([])
          setTableReady(false)
        }
        setLoading(false)
      })
      .catch(() => { setList([]); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const totalMonthly = list.filter(f => f.is_active).reduce((s, f) => s + f.amount, 0)

  const handleAdd = async () => {
    if (!newAmount) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/fixed-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, amount: Number(newAmount), name: newName || FIXED_COST_CATEGORIES[newCategory] }),
      })
      const d = await res.json()
      if (d.ok) { showMsg('✅ 追加しました', 'success'); setShowAdd(false); setNewName(''); setNewAmount(''); load() }
      else showMsg(`❌ ${d.error ?? '追加に失敗しました'}`, 'error')
    } catch {
      showMsg('❌ 通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/fixed-costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, amount: Number(editAmount) }),
      })
      const d = await res.json()
      if (d.ok) { showMsg('✅ 更新しました', 'success'); setEditId(null); load() }
      else showMsg(`❌ ${d.error ?? '更新に失敗しました'}`, 'error')
    } catch {
      showMsg('❌ 通信エラーが発生しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (item: FixedCost) => {
    try {
      await fetch('/api/settings/fixed-costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      })
      load()
    } catch {
      showMsg('❌ 通信エラーが発生しました', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この固定費を削除しますか？')) return
    try {
      await fetch(`/api/settings/fixed-costs?id=${id}`, { method: 'DELETE' })
      load()
    } catch {
      showMsg('❌ 削除に失敗しました', 'error')
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>

  if (!tableReady) return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
      <p className="font-bold mb-1">⚠️ 固定費テーブルが未作成です</p>
      <p className="text-xs">Supabase で以下のSQLを実行してください：</p>
      <pre className="bg-yellow-100 rounded-lg p-2 mt-2 text-[10px] overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS fixed_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id text NOT NULL,
  category text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);`}</pre>
      <button onClick={load} className="mt-3 w-full bg-yellow-500 text-white text-sm font-semibold py-2 rounded-xl">
        再読み込み
      </button>
    </div>
  )

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* 月合計 */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 text-center">
        <p className="text-xs text-gray-400">月間固定費合計（有効分）</p>
        <p className="text-3xl font-black text-gray-900 mt-1">¥{totalMonthly.toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-0.5">毎月1日に自動で経費に計上されます</p>
      </div>

      {/* 追加ボタン */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full mb-4 py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-500 text-sm font-semibold hover:bg-purple-50"
      >
        {showAdd ? '✕ キャンセル' : '＋ 固定費を追加する'}
      </button>

      {showAdd && (
        <div className="mb-4 bg-purple-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-purple-700">新しい固定費</p>
          <div>
            <label className="text-xs text-gray-500">カテゴリ</label>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white mt-0.5">
              {Object.entries(FIXED_COST_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">項目名（例：家賃 スケルトン物件）</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder={FIXED_COST_CATEGORIES[newCategory]}
              className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-gray-500">月額（円）</label>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
              placeholder="例: 200000"
              className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white mt-0.5" />
          </div>
          <button onClick={handleAdd} disabled={saving || !newAmount}
            className="w-full bg-purple-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {saving ? '追加中...' : '追加する'}
          </button>
        </div>
      )}

      {/* 一覧 */}
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">固定費が登録されていません</p>
        )}
        {list.map(item => (
          <div key={item.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${!item.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button onClick={() => handleToggle(item)} className="flex-shrink-0">
                  <span className={`inline-block w-8 h-4 rounded-full transition-colors ${item.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name ?? FIXED_COST_CATEGORIES[item.category] ?? item.category}</p>
                  <p className="text-xs text-gray-400">{FIXED_COST_CATEGORIES[item.category] ?? item.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <p className="text-sm font-bold text-gray-800">¥{item.amount.toLocaleString()}</p>
                <button onClick={() => { setEditId(editId === item.id ? null : item.id); setEditName(item.name ?? ''); setEditAmount(String(item.amount)) }}
                  className="text-gray-400 text-xs">✏️</button>
                <button onClick={() => handleDelete(item.id)} className="text-gray-400 text-xs">🗑</button>
              </div>
            </div>
            {editId === item.id && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="項目名"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  placeholder="月額"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                <button onClick={() => handleEdit(item.id)} disabled={saving}
                  className="w-full bg-purple-500 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50">
                  {saving ? '保存中...' : '更新する'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── LINE設定タブ ────────────────────────────────────
function LineTab() {
  const [setupLoading, setSetupLoading] = useState(false)
  const [toast, setToast]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [uploadingStaff, setUploadingStaff]     = useState(false)
  const [uploadingManager, setUploadingManager] = useState(false)
  const [settingDefault, setSettingDefault]     = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [menuStatus, setMenuStatus]       = useState<MenuStatus[] | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const setup = async () => {
    setSetupLoading(true)
    setToast(null)
    try {
      const res = await fetch('/api/line/setup-richmenu', { method: 'POST' })
      const d = await res.json() as { ok?: boolean; error?: string; managers_updated?: { name: string; ok: boolean }[] }
      if (res.ok && d.ok) {
        const managerInfo = d.managers_updated && d.managers_updated.length > 0
          ? `（経営者: ${d.managers_updated.map(m => m.name).join('・')}）`
          : ''
        showToast(`✅ リッチメニューを設定しました！次に画像をアップロードしてください ${managerInfo}`, 'success')
      } else {
        showToast(`❌ 設定に失敗しました: ${d.error ?? '不明なエラー'}`, 'error')
      }
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : '不明なエラー'}`, 'error')
    } finally {
      setSetupLoading(false)
    }
  }

  const uploadImage = async (menuType: 'staff' | 'manager', file: File) => {
    const setter = menuType === 'staff' ? setUploadingStaff : setUploadingManager
    setter(true)
    setToast(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('menu_type', menuType)
      const res  = await fetch('/api/line/upload-richmenu-image', { method: 'POST', body: fd })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) {
        showToast(`✅ ${menuType === 'staff' ? 'スタッフ' : '経営者'}メニューの画像をアップロードしました！`, 'success')
      } else {
        showToast(`❌ アップロード失敗: ${data.error ?? '不明なエラー'}`, 'error')
      }
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : '不明なエラー'}`, 'error')
    } finally {
      setter(false)
    }
  }

  const setDefault = async () => {
    setSettingDefault(true)
    setToast(null)
    try {
      const res  = await fetch('/api/line/set-default-richmenu', { method: 'POST' })
      const data = await res.json() as {
        ok?: boolean
        set_default_ok?: boolean; set_default_status?: number; set_default_error?: string
        set_all_ok?: boolean;     set_all_status?: number;     set_all_error?: string
        managers_updated?: { name: string; status: number }[]
        error?: string
      }
      if (data.ok) {
        const mgr = data.managers_updated?.length
          ? `（経営者 ${data.managers_updated.map(m => m.name).join('・')} にも設定済み）`
          : ''
        showToast(`✅ デフォルト設定完了！LINEを再起動して確認してください ${mgr}`, 'success')
      } else {
        const detail = data.set_default_error ?? data.set_all_error ?? data.error ?? '不明'
        showToast(`❌ デフォルト設定失敗 (${data.set_default_status ?? '?'}): ${detail}`, 'error')
      }
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : '不明なエラー'}`, 'error')
    } finally {
      setSettingDefault(false)
    }
  }

  const checkStatus = async () => {
    setStatusLoading(true)
    setMenuStatus(null)
    try {
      const res  = await fetch('/api/line/richmenu-status')
      const data = await res.json() as { menus?: MenuStatus[]; error?: string }
      if (data.menus) {
        setMenuStatus(data.menus)
      } else {
        showToast(`❌ 確認失敗: ${data.error ?? '不明'}`, 'error')
      }
    } catch (e) {
      showToast(`❌ ${e instanceof Error ? e.message : '不明なエラー'}`, 'error')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleFileSelect = (menuType: 'staff' | 'manager') => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = 'image/jpeg,image/png'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) await uploadImage(menuType, file)
    }
    input.click()
  }

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* メニュー更新（画像を選ぶだけで全部自動） */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-green-500 px-4 py-2">
          <p className="text-xs font-bold text-white">🖼 画像を選ぶだけで自動反映</p>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            画像を選ぶと「メニュー再作成→画像アップ→全員に反映」を自動で行います。
            完了後にLINEを閉じて再起動すると新しい画像が表示されます。
          </p>

          {/* スタッフ用 */}
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-1">👤 スタッフ用メニュー</p>
            <p className="text-[10px] text-gray-400 mb-2">出勤 / 退勤 / シフト / 経営メニューへ / 発注 / シフト確認</p>
            <button
              onClick={() => handleFileSelect('staff')}
              disabled={uploadingStaff}
              className="w-full border-2 border-dashed border-green-300 hover:border-green-500 hover:bg-green-50 text-green-600 text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {uploadingStaff ? '⏳ 処理中（少々お待ちください）...' : '🖼 スタッフ用の画像を選ぶ'}
            </button>
          </div>

          {/* 経営者用 */}
          <div className="border border-gray-100 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-1">👑 経営者用メニュー</p>
            <p className="text-[10px] text-gray-400 mb-2">売上 / PL / シフト / スタッフメニューへ / 発注 / ダッシュボード</p>
            <button
              onClick={() => handleFileSelect('manager')}
              disabled={uploadingManager}
              className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {uploadingManager ? '⏳ 処理中（少々お待ちください）...' : '🖼 経営者用の画像を選ぶ'}
            </button>
          </div>
        </div>
      </div>

      {/* STEP 3: 現在の状態確認 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-600">STEP 3　設定状態を確認する</p>
        </div>
        <div className="p-4">
          <button
            onClick={checkStatus}
            disabled={statusLoading}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-600 font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
          >
            {statusLoading ? '確認中...' : '🔍 現在のメニュー状態を確認する'}
          </button>

          {menuStatus && (
            <div className="mt-3 space-y-2">
              {menuStatus.length === 0 ? (
                <p className="text-xs text-red-500">❌ LINEにリッチメニューが1件も登録されていません。STEP 1から実施してください。</p>
              ) : (
                menuStatus.map(m => (
                  <div key={m.id} className={`rounded-xl p-3 text-xs border ${m.has_image ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-700">{m.name}</span>
                      {m.is_default && <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">デフォルト</span>}
                    </div>
                    <div className="flex gap-3">
                      <span className={m.has_image ? 'text-green-700' : 'text-red-600'}>
                        {m.has_image ? '✅ 画像あり' : '❌ 画像なし → STEP 2でアップロード'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 補足 */}
      <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
        <p className="font-semibold mb-1">💡 画像サイズについて</p>
        <p>Canvaで「2500×1686px」のカスタムサイズで作成するとそのまま使えます。</p>
      </div>
    </div>
  )
}

// ─── メインコンポーネント ────────────────────────────
export default function SettingsClient() {
  const [tab, setTab] = useState<Tab>('store')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'store', label: '店舗設定',    icon: '🏪' },
    { id: 'staff', label: 'スタッフ管理', icon: '👥' },
    { id: 'costs', label: '固定費',      icon: '🏠' },
    { id: 'line',  label: 'LINE設定',    icon: '💬' },
  ]

  return (
    <div>
      {/* タブ */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className="text-base leading-none mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* タブ内容 */}
      {tab === 'store' && <StoreTab />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'costs' && <FixedCostsTab />}
      {tab === 'line'  && <LineTab />}
    </div>
  )
}
