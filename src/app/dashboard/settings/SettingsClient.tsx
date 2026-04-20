'use client'

/**
 * 設定クライアント
 * タブ切り替え: 店舗設定 / スタッフ管理 / LINE設定
 */

import { useState, useEffect, useCallback } from 'react'

type Tab = 'store' | 'staff' | 'line'

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

// ─── LINE設定タブ ────────────────────────────────────
function LineTab() {
  const [loading, setLoading] = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const setup = async () => {
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch('/api/line/setup-richmenu', { method: 'POST' })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && d.ok) setToast({ msg: '✅ リッチメニューを設定しました！LINEアプリで確認してください', type: 'success' })
      else                 setToast({ msg: `❌ 設定に失敗しました: ${d.error ?? '不明なエラー'}`, type: 'error' })
    } catch (e) {
      setToast({ msg: `❌ ${e instanceof Error ? e.message : '不明なエラー'}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <p className="text-sm text-gray-600 mb-4">
        スタッフ用LINEのリッチメニュー（操作パネル）をAPIで自動設定します。
      </p>
      <button
        onClick={setup}
        disabled={loading}
        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
      >
        {loading ? '設定中...' : '📱 LINEリッチメニューを設定する'}
      </button>
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">現在のボタン</p>
        <div className="flex flex-wrap gap-1">
          {['出勤', '退勤', 'シフト希望', '発注依頼', 'シフト確認', 'ヘルプ'].map(label => (
            <span key={label} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{label}</span>
          ))}
        </div>
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
      {tab === 'line'  && <LineTab />}
    </div>
  )
}
