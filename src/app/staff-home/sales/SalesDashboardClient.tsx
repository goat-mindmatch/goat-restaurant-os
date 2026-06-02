'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'

type Judgement = '×' | '◯' | '◎' | '—'

type TodaySalesResponse = {
  date: string
  hour_jst: number
  show_lunch: boolean
  show_total: boolean
  lunch_confirmed: boolean
  targets: {
    monthly: number
    daily: number
    lunch: number
    dinner: number
    lunch_ratio: number
  }
  sales: {
    total: number
    store: number
    anydeli: number
    uber: number
    rocketnow: number
    lunch: number
    dinner: number
    anydeli_cash: number
    anydeli_online: number
  }
  judgements: {
    lunch: Judgement
    dinner: Judgement
    day: Judgement
  }
  month: {
    total: number
    target: number
    progress_pct: number
  }
  staff_meals: {
    today: number
    month: number
  }
  google_reviews: {
    total_count: number
    delta_today: number
    month_attributed: number
  }
}

const yen = (n: number) => `¥${(n ?? 0).toLocaleString()}`
const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function jstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function judgementColor(j: Judgement): string {
  if (j === '◎') return 'text-emerald-600 bg-emerald-50'
  if (j === '◯') return 'text-blue-600 bg-blue-50'
  if (j === '×') return 'text-red-600 bg-red-50'
  return 'text-gray-500 bg-gray-100'
}

export default function SalesDashboardClient() {
  const [date, setDate] = useState<string>(jstToday())
  const [data, setData] = useState<TodaySalesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mealAmount, setMealAmount] = useState('')
  const [mealSaving, setMealSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmingLunch, setConfirmingLunch] = useState(false)
  const [lunchFormOpen, setLunchFormOpen] = useState(false)
  const [uberLunch, setUberLunch] = useState('')
  const [rocketLunch, setRocketLunch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/today-sales?date=${date}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
      setData(j)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const saveMeal = async () => {
    const amount = Number(mealAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('スタッフ飯の金額を入力してください')
      return
    }
    setMealSaving(true)
    try {
      const res = await fetch('/api/staff-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, amount }),
      })
      const j = await res.json()
      if (!res.ok) {
        alert(`保存失敗: ${j.error ?? res.status}`)
        return
      }
      setMealAmount('')
      await load()
    } finally {
      setMealSaving(false)
    }
  }

  const confirmLunch = async () => {
    if (!data) return
    const uLunch = uberLunch === '' ? 0 : Number(uberLunch)
    const rLunch = rocketLunch === '' ? 0 : Number(rocketLunch)
    const lunchTotal = data.sales.store + uLunch + rLunch
    const ok = window.confirm(
      `昼売上を確定します。\n\n` +
      `店頭/エニデリ昼: ${yen(data.sales.store)}\n` +
      `Uber昼: ${yen(uLunch)}\n` +
      `RocketNow昼: ${yen(rLunch)}\n` +
      `─────────\n昼合計: ${yen(lunchTotal)}\n\n` +
      `夜売上 = 1日の総売上 − 昼合計 で自動計算されます。よろしいですか？`
    )
    if (!ok) return
    setConfirmingLunch(true)
    try {
      const res = await fetch('/api/today-sales/confirm-lunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, uber_lunch: uLunch, rocketnow_lunch: rLunch }),
      })
      const j = await res.json()
      if (!res.ok) { alert(`確定失敗: ${j.error ?? res.status}`); return }
      setLunchFormOpen(false)
      setUberLunch(''); setRocketLunch('')
      await load()
    } finally {
      setConfirmingLunch(false)
    }
  }

  const cancelLunch = async () => {
    if (!window.confirm('昼の確定を取り消しますか？')) return
    setConfirmingLunch(true)
    try {
      await fetch(`/api/today-sales/confirm-lunch?date=${date}`, { method: 'DELETE' })
      await load()
    } finally {
      setConfirmingLunch(false)
    }
  }

  const reportText = useMemo(() => {
    if (!data) return ''
    const [y, mo, d] = data.date.split('-').map(Number)
    const weekDay = WEEK_LABELS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]
    const targetMan = Math.round(data.month.target / 10_000)
    const monthLabel = `${mo}月売上目標${targetMan}万円`

    const lunchJ  = data.judgements.lunch  === '—' ? ' '  : data.judgements.lunch
    const dinnerJ = data.judgements.dinner === '—' ? ' '  : data.judgements.dinner

    const lines: string[] = []
    lines.push(`${mo}/${d}（${weekDay}）`)
    lines.push(monthLabel)
    lines.push(`◾️総売上 ${yen(data.sales.total)}`)
    lines.push(`◾️${mo}月売上合計 ${yen(data.month.total)}`)
    lines.push(`◾️出前売上 ${yen(data.sales.anydeli + data.sales.uber + data.sales.rocketnow)}`)
    if (data.sales.rocketnow > 0) lines.push(`◾️ロケットなう ${yen(data.sales.rocketnow)}`)
    if (data.lunch_confirmed) {
      lines.push(`◾️昼 ${lunchJ} ${yen(data.sales.lunch)}`)
      lines.push(`◾️夜 ${dinnerJ} ${yen(data.sales.dinner)}`)
    } else {
      lines.push(`◾️昼 （昼を確定すると表示）`)
      lines.push(`◾️夜 （昼を確定すると表示）`)
    }
    lines.push(`◾️スタッフ飯 ${yen(data.staff_meals.today)}`)
    lines.push(`◾️月間スタッフ飯 ${yen(data.staff_meals.month)}`)
    return lines.join('\n')
  }, [data])

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('コピー失敗: 手動で選択してください')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/staff-home" className="text-gray-400">← ホーム</Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">📊 本日の売上</h1>
          <p className="text-xs text-gray-500">{date}（{data?.hour_jst ?? '--'}時 JST）</p>
        </div>
        <input
          type="date"
          value={date}
          max={jstToday()}
          onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1"
        />
      </div>

      {error && <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {error}</div>}

      {loading && !data && <p className="text-center text-gray-400 py-10">読み込み中...</p>}

      {data && (
        <div className="space-y-4 p-4">
          {/* 当日総売上カード */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">当日総売上</p>
              <span className={`text-sm font-bold px-2 py-1 rounded ${judgementColor(data.judgements.day)}`}>
                {data.judgements.day === '—' ? '判定なし' : `判定 ${data.judgements.day}`}
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{yen(data.sales.total)}</p>
            <p className="text-xs text-gray-400 mt-1">日次目標 {yen(data.targets.daily)} ／ ◎は +¥15,000 以上</p>
          </div>

          {/* 昼を確定（昼営業終了=15時頃に実施） */}
          {!data.lunch_confirmed ? (
            !lunchFormOpen ? (
              <button
                onClick={() => setLunchFormOpen(true)}
                className="w-full bg-amber-500 active:bg-amber-600 text-white rounded-2xl shadow-sm p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">☀️ 昼を確定する</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      昼営業終了時にタップ → Uber/RocketNowの昼分を入力して確定
                    </p>
                  </div>
                  <span className="text-xl">→</span>
                </div>
              </button>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-4 border-2 border-amber-300 space-y-3">
                <p className="text-sm font-bold text-amber-700">☀️ 昼を確定</p>
                <div className="bg-amber-50 rounded-lg p-2 text-xs text-gray-600">
                  店頭/エニデリ昼は自動取込済み: <span className="font-bold">{yen(data.sales.store)}</span>
                  <br />Uber/RocketNowアプリで<b>昼分</b>を確認して入力してください（無ければ0でOK）
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-gray-500">Uber 昼分（円）</span>
                    <input
                      type="number" inputMode="numeric" placeholder="0"
                      value={uberLunch}
                      onChange={e => setUberLunch(e.target.value)}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-500">RocketNow 昼分（円）</span>
                    <input
                      type="number" inputMode="numeric" placeholder="0"
                      value={rocketLunch}
                      onChange={e => setRocketLunch(e.target.value)}
                      className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  昼合計 = 店頭 {yen(data.sales.store)} + Uber {yen(uberLunch === '' ? 0 : Number(uberLunch))} + Rocket {yen(rocketLunch === '' ? 0 : Number(rocketLunch))}
                  　→ <b>{yen(data.sales.store + (uberLunch === '' ? 0 : Number(uberLunch)) + (rocketLunch === '' ? 0 : Number(rocketLunch)))}</b>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setLunchFormOpen(false)} disabled={confirmingLunch}
                    className="bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">
                    キャンセル
                  </button>
                  <button onClick={confirmLunch} disabled={confirmingLunch}
                    className="bg-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                    {confirmingLunch ? '確定中...' : '☀️ 昼を確定'}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
              <p className="text-xs text-amber-700">☀️ 昼確定済み（{yen(data.sales.lunch)}）</p>
              <button onClick={cancelLunch} disabled={confirmingLunch} className="text-xs text-amber-600 underline">
                取り消す
              </button>
            </div>
          )}

          {/* 昼 / 夜カード */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-2xl shadow-sm p-4 ${data.lunch_confirmed ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500">☀️ 昼売上</p>
                {data.lunch_confirmed && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${judgementColor(data.judgements.lunch)}`}>
                    {data.judgements.lunch}
                  </span>
                )}
              </div>
              {data.lunch_confirmed ? (
                <>
                  <p className="text-xl font-bold text-gray-900">{yen(data.sales.lunch)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">目標 {yen(data.targets.lunch)}</p>
                </>
              ) : (
                <p className="text-xs text-gray-400 mt-2">「昼を確定」で表示</p>
              )}
            </div>
            <div className={`rounded-2xl shadow-sm p-4 ${data.lunch_confirmed ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500">🌙 夜売上</p>
                {data.lunch_confirmed && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${judgementColor(data.judgements.dinner)}`}>
                    {data.judgements.dinner}
                  </span>
                )}
              </div>
              {data.lunch_confirmed ? (
                <>
                  <p className="text-xl font-bold text-gray-900">{yen(data.sales.dinner)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">目標 {yen(data.targets.dinner)} ／ 総−昼</p>
                </>
              ) : (
                <p className="text-xs text-gray-400 mt-2">昼確定後に表示</p>
              )}
            </div>
          </div>

          {/* デリバリー手動入力への導線 */}
          <Link href="/staff-home/delivery-input" className="block bg-slate-900 rounded-2xl shadow-sm p-4 text-white active:opacity-90">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">🛵 Uber / RocketNow 売上入力</p>
                <p className="text-xs opacity-70 mt-0.5">アプリの数字を見て入力するだけ</p>
              </div>
              <span className="text-xl">→</span>
            </div>
          </Link>

          {/* 内訳 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">📋 売上内訳</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">店頭（エニデリ）</span><span className="font-medium">{yen(data.sales.anydeli)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Uber Eats</span><span className="font-medium">{yen(data.sales.uber)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">ロケットなう</span><span className="font-medium">{yen(data.sales.rocketnow)}</span></div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">出前合計</span>
                <span className="font-medium">{yen(data.sales.anydeli + data.sales.uber + data.sales.rocketnow)}</span>
              </div>
            </div>
          </div>

          {/* 月次進捗 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-500">📈 今月累計</p>
              <p className="text-xs text-gray-400">{data.month.progress_pct}% 達成</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{yen(data.month.total)}</p>
            <p className="text-xs text-gray-400 mt-1">目標 {yen(data.month.target)}</p>
            <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${Math.min(data.month.progress_pct, 100)}%` }} />
            </div>
          </div>

          {/* Google口コミ */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">⭐ Google口コミ</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.google_reviews.total_count}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">総件数</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">+{data.google_reviews.delta_today}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">本日増加</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{data.google_reviews.month_attributed}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">月EXP配分</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-3">
              ※ Places APIで自動取得。出勤スタッフへ自動配分されます（スクショ送付不要）
            </p>
          </div>

          {/* スタッフ飯入力 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500">🍽️ スタッフ飯</p>
              <p className="text-xs text-gray-400">本日 {yen(data.staff_meals.today)} ／ 当月 {yen(data.staff_meals.month)}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="金額（円）"
                value={mealAmount}
                onChange={e => setMealAmount(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={saveMeal}
                disabled={mealSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {mealSaving ? '保存中' : '追加'}
              </button>
            </div>
          </div>

          {/* 報告文コピー */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">📝 報告文（コピー用）</p>
              <button
                onClick={copyReport}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${copied ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'}`}
              >
                {copied ? '✅ コピー済み' : '📋 コピー'}
              </button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{reportText}</pre>
          </div>

          <p className="text-center text-[10px] text-gray-400 pt-2">
            ※ 自動取込（15時 / 21時 / 23時）後に最新化されます
          </p>
        </div>
      )}
    </main>
  )
}
