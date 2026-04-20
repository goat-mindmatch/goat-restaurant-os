'use client'

/**
 * 勤怠手動修正コンポーネント
 * - 打刻忘れ・LINE不具合時の管理者による手動入力
 * - 日付選択 → その日の出勤一覧表示 → 編集/追加
 */

import { useState, useEffect, useCallback } from 'react'

type Staff = { id: string; name: string }
type AttendanceRow = {
  id: string
  staff_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  break_minutes: number
  work_minutes: number | null
  recorded_via: string
  staff: { name: string } | null
}

const TIME_OPTIONS = Array.from({ length: 41 }, (_, i) => {
  const totalMin = 6 * 60 + i * 30 // 6:00 〜 26:00（翌2:00）
  const hour = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
})

export default function AttendanceClient({ staffList }: { staffList: Staff[] }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]               = useState(today)
  const [records, setRecords]         = useState<AttendanceRow[]>([])
  const [loading, setLoading]         = useState(false)
  const [editId, setEditId]           = useState<string | null>(null)
  const [showAdd, setShowAdd]         = useState(false)

  // 編集フィールド
  const [editIn, setEditIn]           = useState('')
  const [editOut, setEditOut]         = useState('')
  const [editBreak, setEditBreak]     = useState('0')
  const [saving, setSaving]           = useState(false)

  // 追加フィールド
  const [addStaff, setAddStaff]       = useState('')
  const [addIn, setAddIn]             = useState('09:00')
  const [addOut, setAddOut]           = useState('')
  const [addBreak, setAddBreak]       = useState('0')
  const [adding, setAdding]           = useState(false)

  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showMsg = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance?date=${date}`)
      const d = await res.json() as AttendanceRow[]
      setRecords(Array.isArray(d) ? d : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, clock_in: editIn || null, clock_out: editOut || null, break_minutes: Number(editBreak) }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) { showMsg('✅ 修正しました', 'success'); setEditId(null); load() }
      else        showMsg(`❌ ${d.error ?? '失敗しました'}`, 'error')
    } catch { showMsg('❌ 失敗しました', 'error') }
    finally { setSaving(false) }
  }

  const addRecord = async () => {
    if (!addStaff) return
    setAdding(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: addStaff,
          date,
          clock_in: addIn || null,
          clock_out: addOut || null,
          break_minutes: Number(addBreak),
        }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) {
        showMsg('✅ 追加しました', 'success')
        setShowAdd(false); setAddStaff(''); setAddOut('')
        load()
      } else {
        showMsg(`❌ ${d.error ?? '失敗しました'}`, 'error')
      }
    } catch { showMsg('❌ 失敗しました', 'error') }
    finally { setAdding(false) }
  }

  return (
    <div className="mx-4 mt-4 mb-2">
      <h2 className="text-sm font-semibold text-gray-500 mb-2">✏️ 勤怠手動修正</h2>

      {/* 日付選択 */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
        <label className="text-xs text-gray-500 block mb-1">対象日を選択</label>
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setEditId(null); setShowAdd(false) }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          max={today}
        />
      </div>

      {/* トースト */}
      {toast && (
        <div className={`mb-3 rounded-xl px-4 py-3 text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 打刻一覧 */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-3">
        {loading ? (
          <p className="p-4 text-sm text-gray-400 text-center">読み込み中...</p>
        ) : records.length === 0 ? (
          <p className="p-4 text-sm text-gray-400 text-center">この日の打刻データなし</p>
        ) : records.map(r => (
          <div key={r.id}>
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer"
              onClick={() => {
                if (editId === r.id) { setEditId(null) }
                else {
                  setEditId(r.id)
                  setEditIn(r.clock_in?.slice(0, 5) ?? '')
                  setEditOut(r.clock_out?.slice(0, 5) ?? '')
                  setEditBreak(String(r.break_minutes ?? 0))
                }
              }}
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">{r.staff?.name ?? '不明'}</p>
                <p className="text-xs text-gray-400">
                  {r.clock_in?.slice(0, 5) ?? '--:--'} 〜 {r.clock_out?.slice(0, 5) ?? '未退勤'}
                  {r.work_minutes != null && <span className="ml-1">（{Math.floor(r.work_minutes / 60)}h{r.work_minutes % 60}m）</span>}
                  {r.recorded_via === 'manual' && <span className="ml-1 text-orange-400">手動</span>}
                </p>
              </div>
              <span className="text-gray-300 text-xs">{editId === r.id ? '▲' : '編集'}</span>
            </div>

            {editId === r.id && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">出勤</label>
                    <select value={editIn} onChange={e => setEditIn(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                      <option value="">--</option>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">退勤</label>
                    <select value={editOut} onChange={e => setEditOut(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                      <option value="">--</option>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">休憩（分）</label>
                  <input type="number" value={editBreak} onChange={e => setEditBreak(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                    min={0} step={15} />
                </div>
                <button onClick={() => saveEdit(r.id)} disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 打刻追加 */}
      <button onClick={() => setShowAdd(!showAdd)}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-orange-300 text-orange-500 text-sm font-semibold hover:bg-orange-50 transition-colors mb-3">
        {showAdd ? '✕ キャンセル' : '＋ 打刻を追加する（打刻忘れ）'}
      </button>

      {showAdd && (
        <div className="bg-orange-50 rounded-xl p-4 space-y-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">スタッフ</label>
            <select value={addStaff} onChange={e => setAddStaff(e.target.value)}
              className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">選択してください</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">出勤</label>
              <select value={addIn} onChange={e => setAddIn(e.target.value)}
                className="w-full border border-orange-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none">
                <option value="">--</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">退勤</label>
              <select value={addOut} onChange={e => setAddOut(e.target.value)}
                className="w-full border border-orange-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none">
                <option value="">--（未退勤）</option>
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">休憩（分）</label>
            <input type="number" value={addBreak} onChange={e => setAddBreak(e.target.value)}
              className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
              min={0} step={15} />
          </div>
          <button onClick={addRecord} disabled={adding || !addStaff}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {adding ? '追加中...' : '追加する'}
          </button>
        </div>
      )}
    </div>
  )
}
