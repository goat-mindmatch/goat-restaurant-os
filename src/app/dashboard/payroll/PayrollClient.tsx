'use client'

import { useState, useMemo } from 'react'

type Staff = { id: string; name: string; hourly_wage: number; transport_fee: number | null }
type Attendance = {
  staff_id: string; date: string; clock_in: string | null; clock_out: string | null
  work_minutes: number | null; break_minutes: number
}

const REVIEW_BONUS_PER = 100

function calcLateNightMinutes(clockIn: string | null, clockOut: string | null): number {
  if (!clockIn || !clockOut) return 0
  const [inH, inM] = clockIn.split(':').map(Number)
  const [outH, outM] = clockOut.split(':').map(Number)
  const endMin = outH * 60 + outM
  const lateStart = 22 * 60
  if (endMin <= lateStart) return 0
  const effectiveStart = Math.max(inH * 60 + inM, lateStart)
  return Math.max(0, endMin - effectiveStart)
}

export default function PayrollClient({
  staffList, attendance, reviewCountMap, month, year,
  onMonthChange,
}: {
  staffList: Staff[]
  attendance: Attendance[]
  reviewCountMap: Record<string, number>
  month: number
  year: number
  onMonthChange: (year: number, month: number) => void
}) {
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  // 給与確定済みスタッフ
  const [paidStaff, setPaidStaff] = useState<Set<string>>(new Set())
  // 編集中の時給・交通費
  const [editingWage, setEditingWage] = useState<Record<string, number>>({})
  const [editingTransport, setEditingTransport] = useState<Record<string, number>>({})
  const [savingWage, setSavingWage] = useState<string | null>(null)

  const summaries = useMemo(() => {
    return staffList.map(staff => {
      const wage = editingWage[staff.id] ?? staff.hourly_wage
      const transport = editingTransport[staff.id] ?? (staff.transport_fee ?? 0)
      const myAtt = attendance.filter(a => a.staff_id === staff.id && a.work_minutes)
      const totalMinutes = myAtt.reduce((s, a) => s + (a.work_minutes ?? 0), 0)
      const totalDays = myAtt.length
      const totalHours = totalMinutes / 60
      const lateNightMin = myAtt.reduce((s, a) => s + calcLateNightMinutes(a.clock_in, a.clock_out), 0)
      const lateNightHours = lateNightMin / 60
      const basePay = Math.round(totalHours * wage)
      const lateNightPremium = Math.round(lateNightHours * wage * 0.25)
      const transportTotal = totalDays * transport
      const reviewCount = reviewCountMap[staff.id] ?? 0
      const reviewBonus = reviewCount * REVIEW_BONUS_PER
      const totalPay = basePay + lateNightPremium + transportTotal + reviewBonus
      return {
        staff, wage, transport,
        totalDays, totalMinutes, totalHours, lateNightHours,
        basePay, lateNightPremium, transportTotal,
        reviewCount, reviewBonus,
        totalPay, att: myAtt,
      }
    })
  }, [staffList, attendance, reviewCountMap, editingWage, editingTransport])

  const grandTotal    = summaries.reduce((s, x) => s + x.totalPay, 0)
  const grandBase     = summaries.reduce((s, x) => s + x.basePay, 0)
  const grandLateNight = summaries.reduce((s, x) => s + x.lateNightPremium, 0)
  const grandTransport = summaries.reduce((s, x) => s + x.transportTotal, 0)
  const grandBonus    = summaries.reduce((s, x) => s + x.reviewBonus, 0)

  // 時給・交通費を保存
  const saveWage = async (staffId: string) => {
    setSavingWage(staffId)
    const wage = editingWage[staffId]
    const transport = editingTransport[staffId]
    const body: Record<string, number> = {}
    if (wage !== undefined) body.hourly_wage = wage
    if (transport !== undefined) body.transport_fee = transport
    await fetch(`/api/staff/${staffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSavingWage(null)
  }

  const downloadCSV = () => {
    const header = ['氏名', '時給', '勤務日数', '総労働時間', '深夜時間', '基本給', '深夜手当', '交通費', '口コミ件数', '口コミボーナス', '給与合計', '支払い状況']
    const rows = summaries.map(s => [
      s.staff.name, s.wage, s.totalDays, s.totalHours.toFixed(1), s.lateNightHours.toFixed(1),
      s.basePay, s.lateNightPremium, s.transportTotal,
      s.reviewCount, s.reviewBonus, s.totalPay,
      paidStaff.has(s.staff.id) ? '支払い済み' : '未払い',
    ])
    const bom = '\uFEFF'
    const csv = bom + [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll_${year}${String(month).padStart(2, '0')}.csv`
    a.click()
  }

  // 月移動
  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }
  const nextMonth = () => {
    const now = new Date()
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  return (
    <>
      {/* 月切り替え */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm flex items-center justify-between px-4 py-3">
        <button onClick={prevMonth} className="text-xl text-gray-500 px-2">‹</button>
        <p className="font-bold text-gray-800">{year}年 {month}月</p>
        <button onClick={nextMonth} className="text-xl text-gray-500 px-2">›</button>
      </div>

      {/* 月次サマリー */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center col-span-2">
          <p className="text-[10px] text-gray-400">総人件費</p>
          <p className="text-2xl font-bold text-gray-900">¥{grandTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            支払い済み: {paidStaff.size}名 / 未払い: {staffList.length - paidStaff.size}名
          </p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">基本給</p>
          <p className="text-lg font-bold text-gray-800">¥{grandBase.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">深夜手当</p>
          <p className="text-lg font-bold text-purple-600">¥{grandLateNight.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">交通費</p>
          <p className="text-lg font-bold text-blue-600">¥{grandTransport.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-400">口コミボーナス</p>
          <p className="text-lg font-bold text-green-600">¥{grandBonus.toLocaleString()}</p>
        </div>
      </div>

      <div className="mx-4 mt-3">
        <button onClick={downloadCSV} className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm">
          📊 CSV ダウンロード
        </button>
      </div>

      {/* スタッフ別 */}
      <div className="mx-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">スタッフ別</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {summaries.map(s => (
            <div key={s.staff.id}>
              <button onClick={() => setSelectedStaff(s.staff)} className="w-full text-left p-4 hover:bg-gray-50">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800">{s.staff.name}</p>
                    {paidStaff.has(s.staff.id) && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">支払済</span>
                    )}
                  </div>
                  <p className="text-lg font-bold text-gray-900">¥{s.totalPay.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="bg-gray-100 px-2 py-0.5 rounded">基本 ¥{s.basePay.toLocaleString()}</span>
                  {s.lateNightPremium > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">深夜 ¥{s.lateNightPremium.toLocaleString()}</span>}
                  {s.transportTotal > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">交通費 ¥{s.transportTotal.toLocaleString()}</span>}
                  {s.reviewBonus > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">口コミ {s.reviewCount}件 ¥{s.reviewBonus.toLocaleString()}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{s.totalDays}日 / {s.totalHours.toFixed(1)}h（うち深夜{s.lateNightHours.toFixed(1)}h）</p>
              </button>

              {/* 支払い操作 */}
              <div className="px-4 pb-3 flex gap-2 items-center">
                {/* 支払い確定 */}
                <button
                  onClick={() => setPaidStaff(p => {
                    const n = new Set(p)
                    n.has(s.staff.id) ? n.delete(s.staff.id) : n.add(s.staff.id)
                    return n
                  })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                    paidStaff.has(s.staff.id)
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {paidStaff.has(s.staff.id) ? '✅ 支払い済み' : '支払い確定'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 計算式説明 */}
      <div className="mx-4 mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
        <p className="font-bold mb-1">💡 計算式</p>
        <p>給与 =（勤務時間×時給）+（22時以降×時給×0.25）+ 交通費 + 口コミボーナス（1件¥{REVIEW_BONUS_PER}）</p>
      </div>

      {/* 勤務詳細モーダル */}
      {selectedStaff && (() => {
        const s = summaries.find(x => x.staff.id === selectedStaff.id)!
        return (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center" onClick={() => setSelectedStaff(null)}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
                <div>
                  <h3 className="font-bold">{selectedStaff.name} の勤務記録</h3>
                  <p className="text-xs text-gray-500">{year}年{month}月 / ¥{s.totalPay.toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedStaff(null)} className="text-gray-400 text-xl">×</button>
              </div>

              {/* 時給・交通費編集 */}
              <div className="p-4 bg-gray-50 border-b">
                <p className="text-xs font-semibold text-gray-500 mb-2">給与設定</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">時給（円）</label>
                    <input type="number" inputMode="numeric"
                      value={editingWage[selectedStaff.id] ?? selectedStaff.hourly_wage}
                      onChange={e => setEditingWage(p => ({ ...p, [selectedStaff.id]: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">交通費（1日）</label>
                    <input type="number" inputMode="numeric"
                      value={editingTransport[selectedStaff.id] ?? (selectedStaff.transport_fee ?? 0)}
                      onChange={e => setEditingTransport(p => ({ ...p, [selectedStaff.id]: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                </div>
                <button onClick={() => saveWage(selectedStaff.id)} disabled={savingWage === selectedStaff.id}
                  className="mt-2 w-full bg-blue-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50">
                  {savingWage === selectedStaff.id ? '保存中...' : '設定を保存'}
                </button>
              </div>

              {/* 勤務一覧 */}
              <div className="p-3">
                {attendance.filter(a => a.staff_id === selectedStaff.id).sort((a, b) => a.date.localeCompare(b.date)).map(a => {
                  const ln = calcLateNightMinutes(a.clock_in, a.clock_out)
                  return (
                    <div key={a.date} className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                      <span className="text-gray-700">{a.date.slice(5)}</span>
                      <span className="text-gray-800">{a.clock_in?.slice(0, 5) ?? '--:--'} 〜 {a.clock_out?.slice(0, 5) ?? '勤務中'}</span>
                      <span className="text-gray-900 font-medium">
                        {a.work_minutes ? `${(a.work_minutes / 60).toFixed(1)}h` : '-'}
                        {ln > 0 && <span className="text-purple-600 text-xs ml-1">🌙{(ln / 60).toFixed(1)}h</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
