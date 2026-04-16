'use client'

import { useState, useMemo } from 'react'

type Props = {
  staff: { id: string; name: string }
  year: number
  month: number
  existing: { available_dates: string[]; preferred_dates: string[] } | null
  boardRequests: { staff_id: string; available_dates: string[]; staff: { name: string } }[]
  lineUserId: string
}

type DayEntry = {
  date: string      // YYYY-MM-DD
  available: boolean
  startTime: string // HH:MM
  endTime: string   // HH:MM
}

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8  // 8:00〜22:00
  const min = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${min}`
})

export default function ShiftFormClient({ staff, year, month, existing, boardRequests, lineUserId }: Props) {
  const lastDay = new Date(year, month, 0).getDate()

  // 既存データから初期値を生成
  const initialDays = useMemo((): DayEntry[] => {
    return Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isAvailable = existing?.available_dates?.includes(dateStr) ?? false
      return {
        date: dateStr,
        available: isAvailable,
        startTime: '10:00',
        endTime: '17:00',
      }
    })
  }, [year, month, lastDay, existing])

  const [days, setDays] = useState<DayEntry[]>(initialDays)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBoard, setShowBoard] = useState(false)

  // 他スタッフの提出状況（日別）
  const boardMap = useMemo(() => {
    const map: Record<number, string[]> = {}
    for (const req of boardRequests) {
      if (req.staff_id === staff.id) continue // 自分は除く
      const name = req.staff?.name ?? '?'
      for (const dateStr of req.available_dates ?? []) {
        const day = parseInt(dateStr.split('-')[2])
        if (!map[day]) map[day] = []
        map[day].push(name)
      }
    }
    return map
  }, [boardRequests, staff.id])

  const toggleDay = (idx: number) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, available: !d.available } : d))
  }

  const updateTime = (idx: number, field: 'startTime' | 'endTime', value: string) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  const selectedCount = days.filter(d => d.available).length

  const handleSubmit = async () => {
    if (selectedCount === 0) {
      setError('出勤できる日を1日以上選んでください')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/shifts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          year,
          month,
          days: days.filter(d => d.available),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSubmitted(true)
    } catch (e) {
      setError('送信に失敗しました。もう一度試してください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const submittedDays = days.filter(d => d.available)
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-xl font-bold text-gray-800 mb-1">{month}月シフト希望を送りました！</h2>
          <p className="text-sm text-gray-500 mb-6">{selectedCount}日分を提出しました</p>
          <div className="text-left bg-gray-50 rounded-xl p-4 text-sm text-gray-700 mb-6">
            {submittedDays.map(d => {
              const day = parseInt(d.date.split('-')[2])
              const dow = DAYS_JP[new Date(year, month - 1, day).getDay()]
              return (
                <div key={d.date} className="py-1 border-b border-gray-100 last:border-0">
                  {month}/{day}({dow}) {d.startTime}〜{d.endTime}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400">修正したい場合はもう一度フォームを開いて提出し直してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm px-4 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{month}月 シフト希望</h1>
            <p className="text-sm text-gray-500">{staff.name}さん</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
            <p className="text-xs text-gray-400">日選択中</p>
          </div>
        </div>
      </div>

      {/* 他スタッフの提出状況トグル */}
      <div className="mx-4 mt-3">
        <button
          onClick={() => setShowBoard(!showBoard)}
          className="w-full text-left bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium"
        >
          👥 他のスタッフの提出状況を{showBoard ? '隠す' : '見る'}
        </button>
        {showBoard && (
          <div className="bg-white border border-gray-100 rounded-xl mt-1 px-4 py-3 text-sm text-gray-700">
            {Object.keys(boardMap).length === 0 ? (
              <p className="text-gray-400">まだ誰も提出していません</p>
            ) : (
              Object.entries(boardMap)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([day, names]) => {
                  const dow = DAYS_JP[new Date(year, month - 1, Number(day)).getDay()]
                  return (
                    <div key={day} className="py-1 border-b border-gray-50 last:border-0">
                      <span className="font-medium">{month}/{day}({dow})</span>
                      <span className="text-gray-500 ml-2">{names.join('・')}</span>
                    </div>
                  )
                })
            )}
          </div>
        )}
      </div>

      {/* カレンダー */}
      <div className="mx-4 mt-4 space-y-2">
        {days.map((day, idx) => {
          const d = idx + 1
          const date = new Date(year, month - 1, d)
          const dow = date.getDay()
          const dowLabel = DAYS_JP[dow]
          const isSun = dow === 0
          const isSat = dow === 6
          const othersOnDay = boardMap[d] ?? []

          return (
            <div
              key={day.date}
              className={`bg-white rounded-xl shadow-sm transition-all ${day.available ? 'border-2 border-blue-400' : 'border border-gray-100'}`}
            >
              {/* 日付行 */}
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={day.available}
                  onChange={() => toggleDay(idx)}
                  className="w-5 h-5 rounded accent-blue-500"
                />
                <span className={`text-base font-semibold ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'}`}>
                  {month}/{d}（{dowLabel}）
                </span>
                {othersOnDay.length > 0 && (
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {othersOnDay.join('・')}
                  </span>
                )}
              </label>

              {/* 時間入力（チェック時のみ表示） */}
              {day.available && (
                <div className="flex items-center gap-3 px-4 pb-3 border-t border-gray-50 pt-2">
                  <span className="text-xs text-gray-500 w-10">開始</span>
                  <select
                    value={day.startTime}
                    onChange={e => updateTime(idx, 'startTime', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <span className="text-gray-400">〜</span>
                  <span className="text-xs text-gray-500 w-10">終了</span>
                  <select
                    value={day.endTime}
                    onChange={e => updateTime(idx, 'endTime', e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* エラー */}
      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 送信ボタン（固定フッター） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedCount === 0}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-base transition-colors"
        >
          {submitting ? '送信中...' : `${month}月シフト希望を提出する（${selectedCount}日）`}
        </button>
      </div>
    </div>
  )
}
