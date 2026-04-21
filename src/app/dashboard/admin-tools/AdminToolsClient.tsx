'use client'

/**
 * 管理者ツール クライアントコンポーネント
 * 各ボタンは /api/admin/trigger?action=xxx を叩く
 * サーバーサイドで CRON_SECRET を付けてから内部APIを呼ぶ
 */

import { useState } from 'react'

type ToolResult = {
  ok: boolean
  message: string
}

type Tool = {
  id: string
  label: string
  description: string
  icon: string
  category: string
  confirm?: string
}

const TOOLS: Tool[] = [
  {
    id: 'weekly-report',
    label: '週次AIレポート送信',
    description: '今週の売上・口コミをAIが分析してLINEに送信',
    icon: '📊',
    category: 'レポート',
  },
  {
    id: 'ai-manager-check',
    label: 'AI店長モード実行',
    description: '在庫・売上・シフトを確認してアラートを送信',
    icon: '🤖',
    category: 'レポート',
  },
  {
    id: 'daily-report',
    label: '閉店日報LINE送信',
    description: '今日の売上・口コミをまとめてLINEに送信',
    icon: '🌙',
    category: 'レポート',
  },
  {
    id: 'send-mission',
    label: '今日のミッション送信',
    description: '出勤中スタッフ全員にDQ風ミッションLINEを送信',
    icon: '⚔️',
    category: 'LINE送信',
  },
  {
    id: 'send-payslips',
    label: '給与明細一斉送信',
    description: '今月の給与明細を全スタッフのLINEに送信',
    icon: '💴',
    category: 'LINE送信',
    confirm: '全スタッフに給与明細を送信します。よろしいですか？',
  },
  {
    id: 'auto-order',
    label: '在庫自動発注メール',
    description: '在庫が基準値を下回っている食材の発注メールを送信',
    icon: '📦',
    category: '在庫・発注',
    confirm: '発注メールを送信します。よろしいですか？',
  },
  {
    id: 'uber-sync',
    label: 'Uber Eats CSV取込',
    description: 'CSVファイルの取込は Uber Eats取込ページ から行ってください',
    icon: '🛵',
    category: '在庫・発注',
  },
  {
    id: 'setup-richmenu',
    label: 'リッチメニュー セットアップ',
    description: 'LINEのボタン動作を最新設定に更新します。画像アップロード後に必ず実行してください',
    icon: '📲',
    category: 'LINE設定',
    confirm: 'リッチメニューを再作成します。全スタッフのLINEメニューが切り替わります。よろしいですか？',
  },
]

const CATEGORIES = ['レポート', 'LINE送信', '在庫・発注', 'LINE設定']

export default function AdminToolsClient() {
  const [results, setResults] = useState<Record<string, ToolResult | null>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const runTool = async (tool: Tool) => {
    if (tool.id === 'uber-sync') {
      window.location.href = '/dashboard/sales/uber-import'
      return
    }

    if (tool.confirm && !window.confirm(tool.confirm)) return

    setLoading(prev => ({ ...prev, [tool.id]: true }))
    setResults(prev => ({ ...prev, [tool.id]: null }))

    try {
      const res = await fetch('/api/admin/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: tool.id }),
      })
      const data = await res.json()
      setResults(prev => ({
        ...prev,
        [tool.id]: {
          ok: res.ok && (data.ok !== false),
          message: data.message ?? data.error ?? (res.ok ? '✅ 実行完了' : '⚠️ エラー'),
        },
      }))
    } catch (e) {
      setResults(prev => ({
        ...prev,
        [tool.id]: { ok: false, message: `❌ ${(e as Error).message}` },
      }))
    } finally {
      setLoading(prev => ({ ...prev, [tool.id]: false }))
    }
  }

  return (
    <div className="px-4 pt-4 space-y-6 pb-4">
      {/* 注意書き */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
        ⚠️ このページは管理者専用です。各ボタンは本番データに直接影響します。
      </div>

      {CATEGORIES.map(cat => {
        const catTools = TOOLS.filter(t => t.category === cat)
        return (
          <div key={cat}>
            <p className="text-xs font-bold text-gray-400 mb-2">{cat}</p>
            <div className="space-y-3">
              {catTools.map(tool => {
                const result = results[tool.id]
                const isLoading = loading[tool.id]

                return (
                  <div key={tool.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{tool.icon}</span>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{tool.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{tool.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => runTool(tool)}
                        disabled={isLoading}
                        className="shrink-0 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40 active:scale-95 transition-transform whitespace-nowrap"
                      >
                        {isLoading ? '実行中…' : '実行'}
                      </button>
                    </div>

                    {result && (
                      <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${
                        result.ok
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {result.message}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
