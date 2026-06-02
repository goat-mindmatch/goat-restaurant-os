'use client'

/**
 * /dashboard/cash-register
 * 現金売上確認ページ
 * AnyDeliから自動取込した現金・オンライン内訳を表示する
 */

import { useState, useEffect, useCallback } from 'react'

type Recent3Row = {
  date:          string
  anydeli_sales: number
  cash_sales:    number
  online_sales:  number
  total_sales:   number
}

type RegisterData = {
  date:           string
  change_fund:    number
  cash_sales:     number
  online_sales:   number
  total_sales:    number
  anydeli_orders: number
  expected_total: number
  recent3:        Recent3Row[]
  checked: {
    actual:     number
    diff:       number
    checked_at: string
  } | null
}

function yenFmt(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function jstDate(offsetDays = 0) {
  const d   = new Date()
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  jst.setUTCDate(jst.getUTCDate() + offsetDays)
  return jst.toISOString().split('T')[0]
}

export default function CashRegisterPage() {
  const [date, setDate]       = useState(jstDate(0))   // 今日
  const [data, setData]       = useState<RegisterData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/cash/register?date=${d}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'データ取得失敗')
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(date) }, [date, fetchData])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h1 className="text-xl font-bold text-gray-800">💴 現金売上</h1>
          <p className="text-sm text-gray-500 mt-1">AnyDeliから自動取込（15時・21時・23時）</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setDate(jstDate(0))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${date === jstDate(0) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              今日
            </button>
            <button
              onClick={() => setDate(jstDate(-1))}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${date === jstDate(-1) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              昨日
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto"
            />
          </div>
        </div>

        {/* 直近3日サマリー（一覧で素早く確認） */}
        {data && data.recent3 && data.recent3.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              📅 直近3日サマリー
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left py-1.5 font-medium">日付</th>
                    <th className="text-right py-1.5 font-medium">売上</th>
                    <th className="text-right py-1.5 font-medium">現金</th>
                    <th className="text-right py-1.5 font-medium">オンライン</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent3.map(r => (
                    <tr
                      key={r.date}
                      onClick={() => setDate(r.date)}
                      className={`border-b last:border-0 cursor-pointer hover:bg-gray-50 ${r.date === date ? 'bg-blue-50' : ''}`}
                    >
                      <td className="py-2 text-gray-700">{r.date.slice(5).replace('-', '/')}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{yenFmt(r.anydeli_sales)}</td>
                      <td className="py-2 text-right text-orange-600">{r.cash_sales > 0 ? yenFmt(r.cash_sales) : '—'}</td>
                      <td className="py-2 text-right text-blue-600">{r.online_sales > 0 ? yenFmt(r.online_sales) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">行をタップすると詳細を表示します</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* データ表示 */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
            <div className="text-3xl mb-2 animate-pulse">💴</div>
            読み込み中...
          </div>
        ) : data ? (
          <>
            {/* モバイルオーダー内訳 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                📱 AnyDeli モバイルオーダー — {date}
              </div>

              {data.total_sales === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <div className="text-3xl mb-2">📭</div>
                  <div className="text-sm">この日のデータがまだ取込まれていません</div>
                  <div className="text-xs mt-1">自動取込は 15:00 / 21:00 / 23:00 に実行されます</div>
                </div>
              ) : (
                <>
                  {/* 合計 */}
                  <div className="text-center py-4 border-b mb-4">
                    <div className="text-xs text-gray-400 mb-1">売上合計</div>
                    <div className="text-4xl font-bold">{yenFmt(data.total_sales)}</div>
                    <div className="text-sm text-gray-400 mt-1">{data.anydeli_orders}件</div>
                  </div>

                  {/* オンライン/現金の内訳 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-blue-500 font-medium mb-1">💳 オンライン</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {data.online_sales > 0 ? yenFmt(data.online_sales) : '—'}
                      </div>
                      <div className="text-xs text-blue-400 mt-1">PayPay / クレカ</div>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-orange-500 font-medium mb-1">💴 現金</div>
                      <div className="text-2xl font-bold text-orange-700">
                        {data.cash_sales > 0 ? yenFmt(data.cash_sales) : '—'}
                      </div>
                      <div className="text-xs text-orange-400 mt-1">レジ現金</div>
                    </div>
                  </div>

                  {/* 内訳不明の場合 */}
                  {data.online_sales === 0 && data.cash_sales === 0 && data.total_sales > 0 && (
                    <div className="mt-3 text-xs text-gray-400 text-center">
                      ※ 現金/オンライン内訳は翌日以降に確定します
                    </div>
                  )}
                </>
              )}
            </div>

            {/* レジ内想定金額 */}
            {data.total_sales > 0 && data.cash_sales > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  🗂️ レジ内 想定金額
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">つり銭準備金</span>
                    <span className="font-medium text-blue-600">{yenFmt(data.change_fund)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">現金売上</span>
                    <span className="font-medium">{yenFmt(data.cash_sales)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>合計（想定）</span>
                    <span className="text-lg">{yenFmt(data.expected_total)}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* 取込スケジュール説明 */}
        <div className="bg-gray-100 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <div className="font-medium text-gray-600">🕐 自動取込スケジュール</div>
          <div>15:00 — 昼営業終了後の売上確認</div>
          <div>21:00 — 夜営業終了後の売上確認</div>
          <div>23:00 — 営業終了後の最終データ</div>
        </div>
      </div>
    </div>
  )
}
