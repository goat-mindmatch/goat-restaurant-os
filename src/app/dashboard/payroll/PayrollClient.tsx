'use client'

import { useState, useMemo } from 'react'

type Staff = { id: string; name: string; hourly_wage: number }
type Attendance = {
  staff_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  work_minutes: number | null
  break_minutes: number
}

export default function PayrollClient({
  staffList, attendance, month,
}: {
  staffList: Staff[]
  attendance: Attendance[]
  month: number
}) {
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)

  // スタッフごとの集計
  const summaries = useMemo(() => {
    return staffList.map(staff => {
      const myAtt = attendance.filter(a => a.staff_id === staff.id && a.work_minutes)
      const totalMinutes = myAtt.reduce((s, a) => s + (a.work_minutes ?? 0), 0)
      const totalDays = myAtt.length
      const totalHours = totalMinutes / 60
      const totalPay = Math.round(totalHours * staff.hourly_wage)
      return { staff, totalDays, totalMinutes, totalHours, totalPay, att: myAtt }
    })
  }, [staffList, attendance])

  const grandTotal = summaries.reduce((s, x) => s + x.totalPay, 0)
  const grandHours = summaries.reduce((s, x) => s + x.totalHours, 0)
  const grandDays = summaries.reduce((s, x) => s + x.totalDays, 0)

  const downloadCSV = () => {
    const header = ['氏名', '時給', '勤務日数', '総労働時間', '給与総額']
    const rows = summaries.map(s => [
      s.staff.name,
      s.staff.hourly_wage,
      s.totalDays,
      s.totalHours.toFixed(1),
      s.totalPay,
    ])
    const bom = '\uFEFF'
    const csv = bom + [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* サマリー */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">総人件費</p>
          <p className="text-lg font-bold text-gray-900">¥{grandTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">総労働時間</p>
          <p className="text-lg font-bold text-gray-800">{grandHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-400">延べ出勤</p>
          <p className="text-lg font-bold text-gray-800">{grandDays}日</p>
        </div>
      </div>

      {/* CSV ダウンロード */}
      <div className="mx-4 mt-3">
        <button onClick={downloadCSV}
          className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm">
          📊 CSV ダウンロード
        </button>
      </div>

      {/* スタッフ別集計 */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">スタッフ別</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {summaries.map(s => (
            <button key={s.staff.id} onClick={() => setSelectedStaff(s.staff)}
              className="w-full text-left p-4 hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800">{s.staff.name}</p>
                  <p className="text-xs text-gray-500">
                    時給¥{s.staff.hourly_wage.toLocaleString()} × {s.totalHours.toFixed(1)}h ({s.totalDays}日)
                  </p>
                </div>
                <p className="text-lg font-bold text-gray-900">¥{s.totalPay.toLocaleString()}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 個別詳細モーダル */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedStaff(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <div>
                <h3 className="font-bold">{selectedStaff.name} の勤務記録</h3>
                <p className="text-xs text-gray-500">{month}月分</p>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-3">
              {attendance
                .filter(a => a.staff_id === selectedStaff.id)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(a => (
                  <div key={a.date} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{a.date.slice(5)}</span>
                    <span className="text-sm text-gray-800">
                      {a.clock_in?.slice(0, 5) ?? '--:--'}
                      {' 〜 '}
                      {a.clock_out?.slice(0, 5) ?? '勤務中'}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {a.work_minutes ? `${(a.work_minutes / 60).toFixed(1)}h` : '-'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
