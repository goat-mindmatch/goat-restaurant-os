'use client'

/**
 * メニューエンジニアリング クライアントコンポーネント
 * 4象限タブ + 散布図マトリクス + AI分析
 */

import { useState } from 'react'
import type { MenuEngineeringItem } from './page'

type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'

const QUADRANT_CONFIG: Record<Quadrant, { label: string; icon: string; color: string; bg: string; action: string; dqLabel: string }> = {
  star:       { label: '勇者級',     dqLabel: '勇者級 ⚔️',  icon: '⚔️', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', action: '価格アップ・積極プロモーション' },
  plowhorse:  { label: '戦士級',     dqLabel: '戦士級 🛡️',  icon: '🛡️', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   action: '原価削減・仕入れ見直し' },
  puzzle:     { label: '魔法使い級', dqLabel: '魔法使い級 🔮', icon: '🔮', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', action: '認知度向上・メニュー内での露出強化' },
  dog:        { label: 'スライム級', dqLabel: 'スライム級 🟡', icon: '🟡', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',     action: 'メニューから廃盤・リニューアル検討' },
}

const QUADRANT_ORDER: Quadrant[] = ['star', 'plowhorse', 'puzzle', 'dog']

type Props = {
  items: MenuEngineeringItem[]
  medianOrders: number
  medianProfitRate: number
}

export default function MenuEngineeringClient({ items, medianOrders, medianProfitRate }: Props) {
  const [activeTab, setActiveTab] = useState<Quadrant>('star')
  const [aiComment, setAiComment] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showMatrix, setShowMatrix] = useState(true)

  const grouped = QUADRANT_ORDER.reduce<Record<Quadrant, MenuEngineeringItem[]>>(
    (acc, q) => {
      acc[q] = items.filter(i => i.quadrant === q)
      return acc
    },
    { star: [], plowhorse: [], puzzle: [], dog: [] }
  )

  const activeItems = grouped[activeTab]
  const cfg = QUADRANT_CONFIG[activeTab]

  async function handleAiAnalyze() {
    setAiLoading(true)
    setAiError(null)
    setAiComment(null)
    try {
      const res = await fetch('/api/menu/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI分析に失敗しました')
      setAiComment(data.comment)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }

  // 散布図用のスケール計算
  const maxOrders = Math.max(...items.map(i => i.order_count), 1)

  return (
    <div className="space-y-4">
      {/* AI分析ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handleAiAnalyze}
          disabled={aiLoading}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          {aiLoading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <span>🤖</span>
          )}
          AI分析を依頼
        </button>
      </div>

      {/* AIコメント */}
      {aiComment && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-700 mb-1">🤖 AI分析コメント</p>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{aiComment}</p>
        </div>
      )}
      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700">{aiError}</p>
        </div>
      )}

      {/* マトリクス図トグル */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700"
          onClick={() => setShowMatrix(m => !m)}
        >
          <span>📊 2×2 マトリクス図</span>
          <span className="text-gray-400">{showMatrix ? '▲' : '▼'}</span>
        </button>
        {showMatrix && (
          <div className="px-4 pb-4">
            <div className="relative w-full" style={{ paddingBottom: '66%' }}>
              <svg
                viewBox="0 0 400 260"
                className="absolute inset-0 w-full h-full"
                style={{ background: '#f8fafc', borderRadius: 8 }}
              >
                {/* 軸ラベル */}
                <text x="200" y="248" textAnchor="middle" fontSize="10" fill="#6b7280">注文数 →</text>
                <text x="12" y="130" textAnchor="middle" fontSize="10" fill="#6b7280" transform="rotate(-90,12,130)">利益率 →</text>

                {/* 象限ラベル */}
                <text x="100" y="18" textAnchor="middle" fontSize="9" fill="#7c3aed" fontWeight="bold">🔮 魔法使い級</text>
                <text x="300" y="18" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="bold">⚔️ 勇者級</text>
                <text x="100" y="248" textAnchor="middle" fontSize="9" fill="#b91c1c" fontWeight="bold">🟡 スライム級</text>
                <text x="300" y="248" textAnchor="middle" fontSize="9" fill="#1d4ed8" fontWeight="bold">🛡️ 戦士級</text>

                {/* 十字線 */}
                <line x1="25" y1="130" x2="390" y2="130" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4,3" />
                <line x1="207" y1="10" x2="207" y2="240" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4,3" />

                {/* ドット */}
                {items.map(item => {
                  const x = 25 + (item.order_count / (maxOrders || 1)) * 360
                  const y = 230 - (item.profit_rate) * 210
                  const color =
                    item.quadrant === 'star'      ? '#f59e0b' :
                    item.quadrant === 'plowhorse' ? '#3b82f6' :
                    item.quadrant === 'puzzle'    ? '#8b5cf6' : '#ef4444'
                  return (
                    <g key={item.id}>
                      <circle cx={x} cy={y} r={5} fill={color} opacity={0.85} />
                      <title>{item.name}（注文: {item.order_count}件, 利益率: {(item.profit_rate * 100).toFixed(0)}%）</title>
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center text-xs">
              {QUADRANT_ORDER.map(q => (
                <div key={q} className="flex items-center gap-1">
                  <span className={`inline-block w-3 h-3 rounded-full ${
                    q === 'star' ? 'bg-yellow-400' : q === 'plowhorse' ? 'bg-blue-500' : q === 'puzzle' ? 'bg-purple-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-600">{QUADRANT_CONFIG[q].icon} {QUADRANT_CONFIG[q].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* タブ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {QUADRANT_ORDER.map(q => (
            <button
              key={q}
              onClick={() => setActiveTab(q)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${
                activeTab === q ? 'text-gray-900 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-base leading-none block mb-0.5">{QUADRANT_CONFIG[q].icon}</span>
              {QUADRANT_CONFIG[q].label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === q ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {grouped[q].length}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg mb-3 border ${cfg.bg} ${cfg.color}`}>
            💡 推奨アクション: {cfg.action}
          </div>

          {activeItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">このカテゴリにはメニューがありません</p>
          ) : (
            <div className="space-y-3">
              {activeItems
                .sort((a, b) => b.order_count - a.order_count)
                .map(item => (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-3 ${cfg.bg}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className={`font-semibold text-sm ${cfg.color}`}>{item.name}</p>
                        {item.category && (
                          <p className="text-xs text-gray-500">{item.category}</p>
                        )}
                      </div>
                      <span className="text-lg">{cfg.icon}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">価格</p>
                        <p className="text-sm font-bold text-gray-800">¥{item.price.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">注文数(3ヶ月)</p>
                        <p className="text-sm font-bold text-gray-800">{item.order_count}件</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">利益率</p>
                        <p className={`text-sm font-bold ${item.profit_rate >= medianProfitRate ? 'text-green-700' : 'text-red-600'}`}>
                          {(item.profit_rate * 100).toFixed(1)}%
                          {item.cost_price === null && <span className="text-xs text-gray-400 ml-1">(推定)</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
