'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PLData = {
  month: string
  revenue: {
    store: number
    delivery: number
    table: number
    total: number
  }
  costs: {
    food: number
    labor: number
    utility: number
    consumable: number
    equipment: number
    rent: number
    communication: number
    other: number
    fixedTotal: number
  }
  grossProfit: number
  operatingProfit: number
  flRatio: number | null
  expenses: ExpenseRow[]
  payrollBreakdown: Array<{ name: string; total: number }>
  laborSource: 'manual' | 'payroll' | 'none'
}

type ExpenseRow = {
  id: string
  date: string
  category: string
  vendor: string | null
  amount: number
  note: string | null
  ai_extracted: boolean
  staff: { name: string } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '食材費',
  utility: '光熱費',
  consumable: '消耗品',
  equipment: '設備費',
  rent: '家賃',
  communication: '通信費',
  other: 'その他',
}

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700',
  utility: 'bg-yellow-100 text-yellow-700',
  consumable: 'bg-green-100 text-green-700',
  equipment: 'bg-blue-100 text-blue-700',
  rent: 'bg-purple-100 text-purple-700',
  communication: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
}

function BarRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((amount / total) * 100)) : 0
  return (
    <div className="py-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">
          ¥{amount.toLocaleString()} <span className="text-xs text-gray-400">({pct}%)</span>
        </span>
      </div>
      <div className="relative w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function PLClient({ data, currentMonth }: { data: PLData; currentMonth: string }) {
  const router = useRouter()
  const [showExpenses, setShowExpenses] = useState(false)
  const [showPayroll, setShowPayroll] = useState(false)

  // 月ナビゲーション
  const prevMonth = () => {
    const [y, m] = data.month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    router.push(`/dashboard/pl?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = data.month.split('-').map(Number)
    const d = new Date(y, m, 1)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (next <= currentMonth) router.push(`/dashboard/pl?month=${next}`)
  }
  const isCurrentMonth = data.month === currentMonth
  const [addForm, setAddForm] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'other', vendor: '', amount: '', note: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [autoCateg, setAutoCateg] = useState(false)

  const handleExcelExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/pl/export?month=${data.month}`)
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PL_${data.month}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMsg('⚠️ Excel出力に失敗しました')
    }
    setExporting(false)
  }

  const handleAutoCategorize = async () => {
    setAutoCateg(true)
    try {
      const res = await fetch('/api/expenses/auto-categorize', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setMsg(`✅ ${json.message}`)
        if (json.updated > 0) setTimeout(() => router.refresh(), 1000)
      } else {
        setMsg(`⚠️ ${json.error ?? '仕分けに失敗しました'}`)
      }
    } catch {
      setMsg('⚠️ 通信エラーが発生しました')
    }
    setAutoCateg(false)
  }

  const handleAddExpense = async () => {
    if (!form.amount) return
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg('✅ 経費を登録しました。ページを再読み込みすると反映されます。')
      setAddForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], category: 'other', vendor: '', amount: '', note: '' })
    } else {
      setMsg('⚠️ 登録に失敗しました。')
    }
  }

  const profitColor = data.operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'
  const profitBg    = data.operatingProfit >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'
  const flColor     = data.flRatio !== null
    ? data.flRatio <= 55 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-400'

  // fixedTotal は rent + communication + equipment の合計のため重複しないよう個別費用で計算
  const totalCosts = data.costs.food + data.costs.labor + data.costs.utility +
    data.costs.consumable + data.costs.equipment + data.costs.rent +
    data.costs.communication + data.costs.other

  return (
    <div className="pb-28">

      {/* 月ナビゲーション */}
      <div className="mx-4 mt-4 flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
        <button
          onClick={prevMonth}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg active:scale-95 transition-transform"
        >‹</button>
        <div className="text-center">
          <p className="text-base font-bold text-gray-900">{data.month}</p>
          {isCurrentMonth && (
            <p className="text-[10px] text-orange-500 font-semibold">今月</p>
          )}
        </div>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg disabled:opacity-30 active:scale-95 transition-transform"
        >›</button>
      </div>

      {/* ═══════════════════════════════════════════
          ★ 今月の手残り（最優先表示）
      ═══════════════════════════════════════════ */}
      <div className="mx-4 mt-4">
        <div className={`bg-gradient-to-br ${profitBg} rounded-2xl p-5 text-white shadow-lg`}>
          <p className="text-sm font-semibold opacity-80 mb-1">💰 今月の手残り（営業利益）</p>
          <p className="text-4xl font-black tracking-tight">
            {data.operatingProfit >= 0 ? '+' : ''}¥{data.operatingProfit.toLocaleString()}
          </p>
          <div className="flex items-center gap-3 mt-2 text-sm opacity-90">
            <span>売上 ¥{data.revenue.total.toLocaleString()}</span>
            <span>−</span>
            <span>費用 ¥{totalCosts.toLocaleString()}</span>
          </div>
          {data.revenue.total > 0 && (
            <div className="mt-3 bg-white/20 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, Math.round((data.operatingProfit / data.revenue.total) * 100)))}%` }}
              />
            </div>
          )}
          {data.revenue.total > 0 && (
            <p className="text-xs opacity-70 mt-1">
              利益率 {Math.round((data.operatingProfit / data.revenue.total) * 100)}%
            </p>
          )}
        </div>
      </div>

      {/* Excel出力 */}
      <div className="mx-4 mt-3 flex justify-end">
        <button
          onClick={handleExcelExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
        >
          {exporting ? '⏳ 出力中...' : '📥 Excel出力'}
        </button>
      </div>

      {/* サマリーカード 2列 */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm col-span-2">
          <p className="text-xs text-gray-400">売上合計</p>
          <p className="text-3xl font-bold text-gray-900">¥{data.revenue.total.toLocaleString()}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            <span>店内 ¥{data.revenue.store.toLocaleString()}</span>
            <span>デリバリー ¥{data.revenue.delivery.toLocaleString()}</span>
            {data.revenue.table > 0 && (
              <span className="text-orange-600 font-semibold">
                テーブル注文 ¥{data.revenue.table.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400">FL比率（目標 ≤55%）</p>
          <p className={`text-2xl font-bold ${flColor}`}>
            {data.flRatio !== null ? `${data.flRatio}%` : 'データなし'}
          </p>
          <p className="text-xs text-gray-400 mt-1">食材費＋人件費÷売上</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400">総費用合計</p>
          <p className="text-2xl font-bold text-gray-700">¥{(data.revenue.total - data.operatingProfit).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {data.revenue.total > 0 ? `売上比 ${Math.round((totalCosts / data.revenue.total) * 100)}%` : ''}
          </p>
        </div>
      </div>

      {/* 費用内訳バー */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">費用内訳</h2>
        <BarRow label="食材費 (F)" amount={data.costs.food}      total={data.revenue.total} color="bg-orange-400" />
        <div>
          <BarRow label="人件費 (L)" amount={data.costs.labor}   total={data.revenue.total} color="bg-blue-400" />
          {/* 人件費ソース バッジ */}
          <div className="flex items-center gap-2 mb-1">
            {data.laborSource === 'payroll' && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                📊 給与システムより自動計算
              </span>
            )}
            {data.laborSource === 'manual' && (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                ✏️ 手入力値を使用
              </span>
            )}
            {data.payrollBreakdown.length > 0 && (
              <button
                onClick={() => setShowPayroll(!showPayroll)}
                className="text-[10px] text-blue-600 underline"
              >
                {showPayroll ? '▲ 閉じる' : '▼ スタッフ別'}
              </button>
            )}
          </div>
          {showPayroll && data.payrollBreakdown.length > 0 && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2 space-y-1">
              {data.payrollBreakdown.map(p => (
                <div key={p.name} className="flex justify-between text-xs text-blue-800">
                  <span>{p.name}</span>
                  <span className="font-semibold">¥{p.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <BarRow label="光熱費"     amount={data.costs.utility}   total={data.revenue.total} color="bg-yellow-400" />
        <BarRow label="消耗品"     amount={data.costs.consumable} total={data.revenue.total} color="bg-green-400" />
        <BarRow label="家賃・固定費"
          amount={data.costs.fixedTotal + data.costs.rent}
          total={data.revenue.total} color="bg-purple-400" />
        <BarRow label="その他"
          amount={data.costs.other + data.costs.equipment + data.costs.communication}
          total={data.revenue.total} color="bg-gray-300" />
      </div>

      {/* PL表 */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-700 mb-3">📋 損益計算書（{data.month}）</h2>
        <div className="space-y-1 text-sm">
          <PLRow label="売上合計" amount={data.revenue.total} bold />
          <PLRow label="  └ 店内売上"      amount={data.revenue.store}    sub />
          <PLRow label="  └ デリバリー売上" amount={data.revenue.delivery} sub />
          {data.revenue.table > 0 && (
            <PLRow label="  └ テーブル注文" amount={data.revenue.table} sub />
          )}
          <div className="border-t border-dashed my-2" />
          <PLRow label="食材費"     amount={-data.costs.food} />
          <PLRow label="人件費"     amount={-data.costs.labor} />
          <PLRow label="光熱費"     amount={-data.costs.utility} />
          <PLRow label="消耗品費"   amount={-data.costs.consumable} />
          <PLRow label="設備費"     amount={-data.costs.equipment} />
          <PLRow label="通信費"     amount={-data.costs.communication} />
          <PLRow label="家賃（固定）" amount={-(data.costs.fixedTotal + data.costs.rent)} />
          <PLRow label="その他経費" amount={-data.costs.other} />
          <div className="border-t border-gray-300 my-2" />
          <PLRow label="営業利益（手残り）" amount={data.operatingProfit} bold profit />
        </div>
      </div>

      {/* 経費明細 */}
      <div className="mx-4 mt-4">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => setShowExpenses(!showExpenses)}
            className="text-sm font-semibold text-gray-700"
          >
            {showExpenses ? '▲' : '▼'} 経費明細（{data.expenses.length}件）
          </button>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={handleAutoCategorize}
              disabled={autoCateg}
              className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {autoCateg ? '⏳ 仕分け中...' : '🤖 AI自動仕分け'}
            </button>
            <a href="/dashboard/receipts"
              className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg font-semibold">
              📷 レシート
            </a>
            <button onClick={() => setAddForm(!addForm)}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold">
              ＋ 手動追加
            </button>
          </div>
        </div>

        {/* 手動追加フォーム */}
        {addForm && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3">
            <h3 className="text-sm font-bold text-blue-800 mb-3">経費を手動登録</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500">日付</label>
                <input type="date" value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">カテゴリ</label>
                <select value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">業者・店名</label>
                <input type="text" value={form.vendor}
                  onChange={e => setForm({ ...form, vendor: e.target.value })}
                  placeholder="例: 業務スーパー"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">金額（円）</label>
                <input type="number" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="例: 15800"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">メモ</label>
                <input type="text" value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="例: 4月分の食材まとめ買い"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <button onClick={handleAddExpense} disabled={saving}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50">
                {saving ? '登録中...' : '✅ 登録する'}
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3 mb-3">
            {msg}
          </div>
        )}

        {/* 経費リスト */}
        {showExpenses && (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {data.expenses.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">
                経費データなし。LINEでレシート写真を送ると自動登録されます。
              </p>
            ) : (
              data.expenses.map(exp => (
                <div key={exp.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.other
                        }`}>
                          {CATEGORY_LABELS[exp.category] ?? exp.category}
                        </span>
                        {exp.ai_extracted && (
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            AI抽出
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {exp.vendor ?? '（業者名なし）'}
                      </p>
                      {exp.note && <p className="text-xs text-gray-500 mt-0.5">{exp.note}</p>}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-bold text-gray-900">¥{exp.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">{exp.date}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* LINE案内 */}
      <div className="mx-4 mt-4 bg-purple-50 border border-purple-100 rounded-xl p-4">
        <p className="text-xs font-bold text-purple-800 mb-1">📱 レシート自動取込</p>
        <p className="text-xs text-purple-700">
          スタッフがLINEにレシートの写真を送ると、AIが金額・店名・カテゴリを自動読み取りして経費に記録します。毎回入力不要です。
        </p>
      </div>
    </div>
  )
}

function PLRow({ label, amount, bold, sub, profit }: {
  label: string; amount: number; bold?: boolean; sub?: boolean; profit?: boolean
}) {
  const isNeg = amount < 0
  const profitClass = profit ? (amount >= 0 ? 'text-green-600' : 'text-red-600') : ''
  return (
    <div className={`flex justify-between ${sub ? 'pl-4 text-gray-400' : ''} ${bold ? 'font-bold' : ''}`}>
      <span className={sub ? 'text-xs' : 'text-sm text-gray-700'}>{label}</span>
      <span className={`${bold ? 'text-base' : 'text-sm'} ${profitClass} ${isNeg && !profit ? 'text-red-700' : ''}`}>
        {amount >= 0 ? `¥${amount.toLocaleString()}` : `-¥${Math.abs(amount).toLocaleString()}`}
      </span>
    </div>
  )
}
