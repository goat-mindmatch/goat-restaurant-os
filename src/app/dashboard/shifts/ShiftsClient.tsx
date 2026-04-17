'use client'

import { useState } from 'react'

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const min = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${min}`
})

type StaffRow = { id: string; name: string }
type StaffDetailRow = {
  id: string
  name: string
  skills: { hall: boolean; cashier: boolean; kitchen: boolean; oneOp: boolean }
  submitted: boolean
  confirmed: { start_time: string; end_time: string; role_on_day: string | null } | null
}

type Props = {
  year: number
  month: number
  lastDay: number
  staffList: StaffRow[]
  // 希望提出マップ (day 番号 → staff_id[])
  requestMap: Record<number, string[]>
  // 確定シフトマップ (day 番号 → staff_id[])
  shiftMap: Record<number, string[]>
  notSubmitted: StaffRow[]
}

export default function ShiftsClient({ year, month, lastDay, staffList, requestMap, shiftMap, notSubmitted }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayDetail, setDayDetail] = useState<StaffDetailRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const days = Array.from({ length: lastDay }, (_, i) => i + 1)

  // 日付詳細を取得
  const openDay = async (day: number) => {
    setSelectedDay(day)
    setLoading(true)
    setDayDetail(null)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const res = await fetch(`/api/shifts/day-detail?date=${dateStr}`)
    const data = await res.json()
    setDayDetail(data.staff)
    setLoading(false)
  }

  // 保存
  const handleSave = async () => {
    if (!dayDetail || !selectedDay) return
    setSaving(true)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    const assignments = dayDetail
      .filter(s => s.confirmed)
      .map(s => ({
        staff_id: s.id,
        start_time: s.confirmed!.start_time,
        end_time: s.confirmed!.end_time,
        role_on_day: s.confirmed!.role_on_day,
      }))
    const res = await fetch('/api/shifts/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, assignments }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      const violations = data.violations ?? []
      const vioText = violations.length > 0
        ? '\n\n⚠️ 制約チェック:\n' + violations.map((v: { message: string }) => v.message).join('\n')
        : ''
      setMessage(`✅ ${month}/${selectedDay}のシフトを確定しました${vioText}`)
      setSelectedDay(null)
      setTimeout(() => window.location.reload(), 800)
    } else {
      setMessage('❌ 保存に失敗しました')
    }
  }

  // スタッフの確定状態をトグル
  const toggleStaff = (staffId: string) => {
    if (!dayDetail) return
    setDayDetail(dayDetail.map(s => {
      if (s.id !== staffId) return s
      if (s.confirmed) {
        return { ...s, confirmed: null }
      } else {
        return {
          ...s,
          confirmed: { start_time: '11:00', end_time: '22:00', role_on_day: null },
        }
      }
    }))
  }

  // 時間更新
  const updateTime = (staffId: string, field: 'start_time' | 'end_time', value: string) => {
    if (!dayDetail) return
    setDayDetail(dayDetail.map(s =>
      s.id === staffId && s.confirmed
        ? { ...s, confirmed: { ...s.confirmed, [field]: value } }
        : s
    ))
  }

  // 役割更新
  const updateRole = (staffId: string, value: string) => {
    if (!dayDetail) return
    setDayDetail(dayDetail.map(s =>
      s.id === staffId && s.confirmed
        ? { ...s, confirmed: { ...s.confirmed, role_on_day: value || null } }
        : s
    ))
  }

  // 一斉通知
  const handleBroadcast = async () => {
    if (!confirm(`${month}月の確定シフトを全スタッフにLINE通知します。よろしいですか？`)) return
    setBroadcasting(true)
    const res = await fetch('/api/shifts/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    })
    const data = await res.json()
    setBroadcasting(false)
    if (res.ok) {
      setMessage(`✅ ${data.sentCount}/${data.totalStaff}名に通知しました`)
    } else {
      setMessage(`❌ 通知失敗: ${data.error}`)
    }
  }

  return (
    <>
      {/* メッセージトースト */}
      {message && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow z-50 text-sm">
          {message}
          <button className="ml-3 opacity-60" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* 未提出者アラート */}
      {notSubmitted.length > 0 && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700 mb-1">
            ⚠️ 未提出 {notSubmitted.length}名
          </p>
          <p className="text-sm text-amber-600">{notSubmitted.map(s => s.name).join('・')}</p>
        </div>
      )}

      {/* サマリーカード */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400">提出済み</p>
          <p className="text-xl font-bold text-green-600">{staffList.length - notSubmitted.length}<span className="text-xs font-normal text-gray-400">/{staffList.length}</span></p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400">確定済み日数</p>
          <p className="text-xl font-bold text-blue-600">{Object.keys(shiftMap).length}<span className="text-xs font-normal text-gray-400">/{lastDay}</span></p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400">対象月</p>
          <p className="text-xl font-bold text-gray-800">{month}月</p>
        </div>
      </div>

      {/* 通知ボタン */}
      <div className="mx-4 mt-3">
        <button
          onClick={handleBroadcast}
          disabled={broadcasting || Object.keys(shiftMap).length === 0}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl text-sm"
        >
          {broadcasting ? '送信中...' : `📢 確定シフトを全員にLINE通知`}
        </button>
      </div>

      {/* カレンダーグリッド */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">日付をタップしてシフトを確定</h2>
        <div className="bg-white rounded-xl shadow-sm p-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_JP.map((d, i) => (
              <div key={d} className={`text-xs text-center font-semibold py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* 月初までの空白 */}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square" />
            ))}
            {days.map(d => {
              const dow = new Date(year, month - 1, d).getDay()
              const submittedCount = requestMap[d]?.length ?? 0
              const confirmedCount = shiftMap[d]?.length ?? 0
              const isConfirmed = confirmedCount > 0
              const isSun = dow === 0
              const isSat = dow === 6
              return (
                <button
                  key={d}
                  onClick={() => openDay(d)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all
                    ${isConfirmed ? 'bg-blue-500 text-white' : submittedCount > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}
                    hover:scale-105 active:scale-95`}
                >
                  <span className={`font-bold text-sm ${isConfirmed ? '' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>
                    {d}
                  </span>
                  {isConfirmed ? (
                    <span className="text-[10px] opacity-90">✓ {confirmedCount}名</span>
                  ) : submittedCount > 0 ? (
                    <span className="text-[10px] text-green-700">希望{submittedCount}</span>
                  ) : (
                    <span className="text-[10px] text-gray-300">–</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-[11px] text-gray-500">
          <span>🟦 確定済み</span>
          <span>🟩 希望提出あり</span>
          <span>⬜ 未提出</span>
        </div>
      </div>

      {/* 日付詳細モーダル */}
      {selectedDay !== null && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {month}/{selectedDay}（{DAYS_JP[new Date(year, month - 1, selectedDay).getDay()]}）シフト確定
                </h3>
                <p className="text-xs text-gray-500">タップでシフト割当・解除</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 text-xl">×</button>
            </div>

            {loading && <div className="p-8 text-center text-gray-400">読み込み中...</div>}

            {!loading && dayDetail && (
              <div className="p-3 space-y-2">
                {dayDetail
                  .sort((a, b) => {
                    // 提出者を上に
                    if (a.submitted && !b.submitted) return -1
                    if (!a.submitted && b.submitted) return 1
                    return 0
                  })
                  .map(s => (
                    <div key={s.id} className={`rounded-xl p-3 transition-all ${s.confirmed ? 'border-2 border-blue-400 bg-blue-50' : s.submitted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!s.confirmed}
                          onChange={() => toggleStaff(s.id)}
                          className="w-5 h-5 accent-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{s.name}</div>
                          <div className="flex gap-1 text-[10px] mt-0.5">
                            {s.skills.hall && <span className="bg-white border px-1.5 rounded">ホール</span>}
                            {s.skills.cashier && <span className="bg-white border px-1.5 rounded">レジ</span>}
                            {s.skills.kitchen && <span className="bg-white border px-1.5 rounded">キッチン</span>}
                            {s.skills.oneOp && <span className="bg-white border px-1.5 rounded">ワンオペ可</span>}
                          </div>
                        </div>
                        {s.submitted && <span className="text-xs font-semibold text-green-700">希望○</span>}
                      </div>

                      {s.confirmed && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <select
                            value={s.confirmed.start_time.slice(0, 5)}
                            onChange={e => updateTime(s.id, 'start_time', e.target.value)}
                            className="border rounded px-2 py-1 bg-white flex-1"
                          >
                            {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                          </select>
                          <span>〜</span>
                          <select
                            value={s.confirmed.end_time.slice(0, 5)}
                            onChange={e => updateTime(s.id, 'end_time', e.target.value)}
                            className="border rounded px-2 py-1 bg-white flex-1"
                          >
                            {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                      )}

                      {s.confirmed && (
                        <div className="mt-2">
                          <input
                            type="text"
                            placeholder="役割（例：ホール、キッチン、ワンオペ）"
                            value={s.confirmed.role_on_day ?? ''}
                            onChange={e => updateRole(s.id, e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm bg-white"
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            <div className="sticky bottom-0 bg-white border-t p-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl"
              >
                {saving ? '保存中...' : 'この日のシフトを確定する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
