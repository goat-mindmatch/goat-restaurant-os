'use client'

/**
 * 混雑予測 クライアントコンポーネント
 * - 来週7日棒グラフ（Tailwind）
 * - 必要スタッフ数
 * - AIの見解
 * - 過去3ヶ月曜日別平均ヒートマップ
 */

import { useEffect, useState } from 'react'
import type { ForecastDay, HeatmapRow } from '@/app/api/forecast/route'

type ForecastData = {
  forecast: ForecastDay[]
  heatmap: HeatmapRow[]
  aiComment: string
}

const DAY_COLOR: Record<string, string> = {
  '月': 'bg-blue-400', '火': 'bg-blue-400', '水': 'bg-blue-400',
  '木': 'bg-blue-400', '金': 'bg-orange-400', '土': 'bg-red-400', '日': 'bg-red-400',
}

function formatYen(n: number) {
  return n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`
}

export default function ForecastClient() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/forecast')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <span className="animate-spin mr-2">⏳</span> データ取得中...
      </div>
    )
  }
  if (error || !data) {
    return <div className="text-red-600 text-sm py-8 text-center">エラー: {error ?? '不明なエラー'}</div>
  }

  const maxSales = Math.max(...data.forecast.map(f => f.predictedSales), 1)

  return (
    <div className="space-y-4">
      {/* 棒グラフ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">📅 来週の売上予測</h2>
        <div className="flex items-end gap-1.5 h-40">
          {data.forecast.map(f => {
            const heightPct = maxSales > 0 ? (f.predictedSales / maxSales) * 100 : 0
            const barColor = DAY_COLOR[f.dayLabel] ?? 'bg-blue-400'
            return (
              <div key={f.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-gray-600 font-semibold leading-none">
                  {formatYen(f.predictedSales)}
                </div>
                <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t ${barColor} transition-all`}
                    style={{ height: `${heightPct}%`, minHeight: f.predictedSales > 0 ? '4px' : '0' }}
                  />
                </div>
                <div className="text-xs text-gray-500 font-medium">{f.dayLabel}</div>
                <div className="text-xs text-gray-400">{f.date.slice(5).replace('-', '/')}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 必要スタッフ数 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">👥 必要スタッフ数目安</h2>
        <div className="divide-y divide-gray-50">
          {data.forecast.map(f => (
            <div key={f.date} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${DAY_COLOR[f.dayLabel] ?? 'bg-blue-400'}`}>
                  {f.dayLabel}
                </span>
                <span className="text-sm text-gray-700">{f.date.slice(5).replace('-', '/')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">{formatYen(f.predictedSales)}</span>
                <span className="text-sm font-bold text-gray-800">
                  {f.requiredStaff}名
                </span>
                <div className="flex gap-0.5">
                  {Array.from({ length: f.requiredStaff }).map((_, i) => (
                    <span key={i} className="text-sm">👤</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">※目安: 売上3万円/人/日で算出</p>
      </div>

      {/* AIの見解 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-indigo-700 mb-2">🤖 AIの見解</h2>
        <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{data.aiComment}</p>
      </div>

      {/* 曜日別ヒートマップ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">🗓️ 過去3ヶ月 曜日別平均売上</h2>
        {(() => {
          const maxAvg = Math.max(...data.heatmap.map(h => h.avg), 1)
          return (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-gray-400 text-center">
                  <th className="py-1 text-left font-medium w-8">曜日</th>
                  <th className="py-1 font-medium">平均</th>
                  <th className="py-1 font-medium">最大</th>
                  <th className="py-1 font-medium">最小</th>
                  <th className="py-1 font-medium">週数</th>
                  <th className="py-1 font-medium w-24">グラフ</th>
                </tr>
              </thead>
              <tbody>
                {data.heatmap.map(h => {
                  const pct = maxAvg > 0 ? (h.avg / maxAvg) * 100 : 0
                  const intensity =
                    pct >= 80 ? 'bg-red-100 text-red-800' :
                    pct >= 60 ? 'bg-orange-100 text-orange-800' :
                    pct >= 40 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-50 text-gray-600'
                  return (
                    <tr key={h.dayName} className={`border-t border-gray-50 ${intensity}`}>
                      <td className="py-1.5 px-1 font-bold text-center">{h.dayName}</td>
                      <td className="py-1.5 text-center font-semibold">{h.avg > 0 ? formatYen(h.avg) : '-'}</td>
                      <td className="py-1.5 text-center text-gray-600">{h.max > 0 ? formatYen(h.max) : '-'}</td>
                      <td className="py-1.5 text-center text-gray-600">{h.min > 0 ? formatYen(h.min) : '-'}</td>
                      <td className="py-1.5 text-center text-gray-400">{h.count}週</td>
                      <td className="py-1.5 px-2">
                        <div className="w-full bg-white rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-current opacity-60"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        })()}
      </div>
    </div>
  )
}
