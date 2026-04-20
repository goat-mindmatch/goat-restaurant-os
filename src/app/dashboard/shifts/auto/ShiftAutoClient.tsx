'use client'

import { useState } from 'react'

type StaffInfo = {
  id: string
  name: string
  max_days_per_week: number | null
}

type Props = {
  year: number
  month: number
  staff: StaffInfo[]
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default function ShiftAutoClient({ year, month, staff }: Props) {
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [shifts, setShifts] = useState<Record<string, string[]> | null>(null)
  const [staffTotals, setStaffTotals] = useState<Record<string, number>>({})

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000) }

  const staffById = Object.fromEntries(staff.map(s => [s.id, s.name]))

  const handleGenerate = async () => {
    setGenerating(true)
    setShifts(null)
    try {
      const res = await fetch('/api/shifts/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json()
      if (res.ok) {
        setShifts(data.shifts)
        setStaffTotals(data.staffTotals ?? {})
        toast('✅ シフト案を生成しました')
      } else {
        toast('❌ ' + (data.error ?? '生成に失敗しました'))
      }
    } catch {
      toast('❌ 通信エラーが発生しました')
    }
    setGenerating(false)
  }

  const handleConfirm = async () => {
    if (!shifts) return
    setConfirming(true)
    try {
      const rows: { date: string; staff_id: string }[] = []
      for (const [date, staffIds] of Object.entries(shifts)) {
        for (const staffId of staffIds) {
          rows.push({ date, staff_id: staffId })
        }
      }
      const res = await fetch('/api/shifts/bulk-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (res.ok) {
        toast(`✅ ${rows.length}件のシフトを確定しました`)
        setShifts(null)
      } else {
        const d = await res.json()
        toast('❌ ' + (d.error ?? '確定に失敗しました'))
      }
    } catch {
      toast('❌ 通信エラーが発生しました')
    }
    setConfirming(false)
  }

  // カレンダー用の日付リスト生成
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const calDays: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="pb-8">
      {/* トースト */}
      {msg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow ${
          msg.startsWith('❌') ? 'bg-red-500' : 'bg-gray-900'
        }`}>
          {msg}
        </div>
      )}

      {/* 生成ボタン */}
      <div className="mx-4 mt-4">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <><span className="animate-spin">⏳</span> AIシフトを生成中...</>
          ) : (
            <>🤖 AIシフトを生成</>
          )}
        </button>
        {generating && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Claude Haiku がシフト案を作成中です（10〜30秒）
          </p>
        )}
      </div>

      {/* 生成結果 */}
      {shifts && (
        <>
          {/* スタッフ別合計 */}
          <div className="mx-4 mt-4">
            <h2 className="text-xs font-bold text-gray-500 mb-2">スタッフ別出勤日数</h2>
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
              {staff.map(s => (
                <div key={s.id} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-gray-800">{s.name}</span>
                  <span className="text-sm font-bold text-blue-600">
                    {staffTotals[s.id] ?? 0}日
                    {s.max_days_per_week && (
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        / 週最大{s.max_days_per_week}日
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* カレンダー表示 */}
          <div className="mx-4 mt-4">
            <h2 className="text-xs font-bold text-gray-500 mb-2">シフト案 — {year}年{month}月</h2>
            <div className="bg-white rounded-xl shadow-sm p-3">
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 mb-1">
                {DOW_LABELS.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-bold py-1 ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                  }`}>{d}</div>
                ))}
              </div>

              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const assigned = shifts[dateStr] ?? []
                  const dow = (firstDow + day - 1) % 7
                  const isWeekend = dow === 0 || dow === 6
                  return (
                    <div
                      key={dateStr}
                      className={`rounded-lg p-1 min-h-[52px] ${
                        assigned.length > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}
                    >
                      <p className={`text-[10px] font-bold mb-0.5 ${
                        isWeekend ? (dow === 0 ? 'text-red-500' : 'text-blue-500') : 'text-gray-600'
                      }`}>{day}</p>
                      <div className="space-y-0.5">
                        {assigned.map(id => (
                          <p key={id} className="text-[9px] bg-blue-500 text-white rounded px-0.5 truncate leading-tight">
                            {(staffById[id] ?? id).slice(0, 4)}
                          </p>
                        ))}
                      </div>
                      {assigned.length === 0 && (
                        <p className="text-[9px] text-gray-300">—</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 確定ボタン */}
          <div className="mx-4 mt-4">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-base disabled:opacity-50"
            >
              {confirming ? '⏳ 確定中...' : '✅ このシフトを確定する'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-1">
              確定するとシフトテーブルに登録されます
            </p>
          </div>
        </>
      )}
    </div>
  )
}
