'use client'

import { useState } from 'react'

type Staff = {
  id: string
  name: string
  role: 'staff' | 'manager'
  hourly_wage: number | null
  transport_fee: number | null
  is_active: boolean
  line_user_id: string | null
}

const ROLE_LABEL: Record<string, string> = {
  staff:   'スタッフ',
  manager: '経営者',
}

export default function StaffClient({ initialStaff }: { initialStaff: Staff[] }) {
  const [staffList, setStaffList] = useState<Staff[]>(initialStaff)
  const [showAdd, setShowAdd]   = useState(false)
  const [editTarget, setEditTarget] = useState<Staff | null>(null)
  const [message, setMessage]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  // PIN管理
  const [pinTarget, setPinTarget] = useState<Staff | null>(null)
  const [pinInput,  setPinInput]  = useState('')

  // 新規追加フォーム
  const [newName,  setNewName]  = useState('')
  const [newRole,  setNewRole]  = useState<'staff' | 'manager'>('staff')
  const [newWage,  setNewWage]  = useState('1100')
  const [newTrans, setNewTrans] = useState('0')

  const toast = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 3000)
  }

  const reload = async () => {
    const res = await fetch('/api/staff')
    const data = await res.json() as Staff[]
    setStaffList(data)
  }

  // 追加
  const handleAdd = async () => {
    if (!newName.trim()) return toast('❌ 名前を入力してください')
    setLoading(true)
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          newName.trim(),
        role:          newRole,
        hourly_wage:   Number(newWage)  || 1100,
        transport_fee: Number(newTrans) || 0,
      }),
    })
    setLoading(false)
    if (res.ok) {
      toast('✅ スタッフを追加しました')
      setNewName(''); setNewRole('staff'); setNewWage('1100'); setNewTrans('0')
      setShowAdd(false)
      await reload()
    } else {
      const d = await res.json() as { error?: string }
      toast(`❌ ${d.error ?? '追加に失敗しました'}`)
    }
  }

  // 更新
  const handleUpdate = async () => {
    if (!editTarget) return
    if (!editTarget.name.trim()) return toast('❌ 名前を入力してください')
    setLoading(true)
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:        'update',
        id:            editTarget.id,
        name:          editTarget.name.trim(),
        role:          editTarget.role,
        hourly_wage:   editTarget.hourly_wage,
        transport_fee: editTarget.transport_fee,
      }),
    })
    setLoading(false)
    if (res.ok) {
      toast('✅ 更新しました')
      setEditTarget(null)
      await reload()
    } else {
      const d = await res.json() as { error?: string }
      toast(`❌ ${d.error ?? '更新に失敗しました'}`)
    }
  }

  // PIN設定
  const handleSetPin = async () => {
    if (!pinTarget) return
    if (pinInput.length < 4) return toast('❌ 4桁以上のPINを入力してください')
    setLoading(true)
    const res = await fetch('/api/auth/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: pinTarget.id, pin: pinInput }),
    })
    setLoading(false)
    if (res.ok) {
      toast(`✅ ${pinTarget.name} のPINを設定しました`)
      setPinTarget(null)
      setPinInput('')
    } else {
      const d = await res.json() as { error?: string }
      toast(`❌ ${d.error ?? 'PIN設定に失敗しました'}`)
    }
  }

  // 退職（論理削除）
  const handleDeactivate = async (s: Staff) => {
    if (!confirm(`「${s.name}」を退職扱いにしますか？`)) return
    setLoading(true)
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate', id: s.id }),
    })
    setLoading(false)
    if (res.ok) {
      toast('✅ 退職処理しました')
      await reload()
    } else {
      toast('❌ 処理に失敗しました')
    }
  }

  const active   = staffList.filter(s => s.is_active)
  const inactive = staffList.filter(s => !s.is_active)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">スタッフ管理</h1>
          <p className="text-sm text-gray-500">在籍 {active.length}名</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl shadow"
        >
          ＋ 追加
        </button>
      </div>

      {/* トースト */}
      {message && (
        <div className="fixed top-4 left-4 right-4 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 z-50 text-center shadow-lg">
          {message}
        </div>
      )}

      {/* 新規追加フォーム */}
      {showAdd && (
        <div className="bg-white rounded-2xl shadow p-4 mb-4 border border-orange-100">
          <p className="text-sm font-bold text-gray-700 mb-3">新しいスタッフを追加</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">名前</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="例：田中"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">役職</label>
              <div className="flex gap-2 mt-1">
                {(['staff', 'manager'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setNewRole(r)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      newRole === r
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">時給（円）</label>
                <input
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                  value={newWage}
                  onChange={e => setNewWage(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">交通費（円/日）</label>
                <input
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                  value={newTrans}
                  onChange={e => setNewTrans(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-500"
              >
                キャンセル
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-sm bg-orange-500 text-white font-bold disabled:opacity-50"
              >
                {loading ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 在籍スタッフ一覧 */}
      <div className="space-y-3">
        {active.map(s => (
          <div key={s.id} className="bg-white rounded-2xl shadow px-4 py-3">
            {editTarget?.id === s.id ? (
              /* 編集モード */
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">名前</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                    value={editTarget.name}
                    onChange={e => setEditTarget({ ...editTarget, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">役職</label>
                  <div className="flex gap-2 mt-1">
                    {(['staff', 'manager'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setEditTarget({ ...editTarget, role: r })}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          editTarget.role === r
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">時給（円）</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                      value={editTarget.hourly_wage ?? ''}
                      onChange={e => setEditTarget({ ...editTarget, hourly_wage: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">交通費（円/日）</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                      value={editTarget.transport_fee ?? ''}
                      onChange={e => setEditTarget({ ...editTarget, transport_fee: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditTarget(null)}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-500"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl text-sm bg-orange-500 text-white font-bold disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '保存する'}
                  </button>
                </div>
              </div>
            ) : (
              /* 表示モード */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                    {s.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.role === 'manager'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ROLE_LABEL[s.role] ?? s.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      時給 ¥{s.hourly_wage?.toLocaleString() ?? '-'}
                      {s.transport_fee ? ` ／ 交通費 ¥${s.transport_fee}/日` : ''}
                    </p>
                    <p className="text-xs mt-0.5">
                      {s.line_user_id
                        ? <span className="text-green-600">✅ LINE連携済み</span>
                        : <span className="text-gray-400">⬜ LINE未連携</span>
                      }
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setEditTarget(s)}
                    className="text-xs text-orange-500 border border-orange-200 rounded-lg px-3 py-1 font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => { setPinTarget(s); setPinInput('') }}
                    className="text-xs text-blue-500 border border-blue-200 rounded-lg px-3 py-1 font-medium"
                  >
                    🔑 PIN
                  </button>
                  <button
                    onClick={() => handleDeactivate(s)}
                    className="text-xs text-red-400 border border-red-200 rounded-lg px-3 py-1"
                  >
                    停止
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PIN設定モーダル */}
      {pinTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">🔑 PIN設定</h3>
            <p className="text-sm text-gray-500 mb-4">{pinTarget.name} のログインPINを設定します</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="4〜8桁の数字"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
              className="w-full border-2 border-orange-200 rounded-xl px-4 py-3 text-2xl text-center tracking-widest font-bold mb-4 focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <p className="text-xs text-gray-400 mb-4 text-center">
              ※ 退職時は「停止」ボタンでログインを無効化できます
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setPinTarget(null); setPinInput('') }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleSetPin}
                disabled={loading || pinInput.length < 4}
                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-40"
              >
                {loading ? '設定中...' : '設定する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 退職済みスタッフ */}
      {inactive.length > 0 && (
        <details className="mt-6">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">
            退職済み（{inactive.length}名）
          </summary>
          <div className="space-y-2 mt-2">
            {inactive.map(s => (
              <div key={s.id} className="bg-gray-50 rounded-xl px-4 py-2 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                    {s.name.slice(0, 1)}
                  </div>
                  <p className="text-sm text-gray-500">{s.name}</p>
                </div>
                <span className="text-xs text-gray-400">退職済み</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
