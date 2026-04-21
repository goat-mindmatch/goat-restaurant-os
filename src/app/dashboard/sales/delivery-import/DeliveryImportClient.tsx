'use client'

/**
 * デリバリー売上取込クライアント
 * - Uber Eats / menu タブ切替
 * - ファイルドロップ or テキスト貼り付け の両対応
 * - 取込結果をインライン表示
 */

import { useState, useRef, useCallback } from 'react'

type Service = 'uber' | 'menu'
type ImportResult = { updated: number; errors: string[]; dates: string[] }

const SERVICE_CONFIG = {
  uber: {
    label: 'Uber Eats',
    icon: '🛵',
    color: '#000000',
    bg: '#f3f4f6',
    accent: '#1a1a1a',
    api: '/api/sales/uber-sync',
    dashboardUrl: 'https://restaurant.uber.com/',
    steps: [
      'Uber Eats レストランダッシュボードを開く',
      '「分析」→「注文レポート」を選択',
      '対象期間を選んで「エクスポート」→ CSVダウンロード',
      'ダウンロードしたファイルを下にドロップ、またはCSV内容を貼り付け',
    ],
    sampleCsv: `日付,注文数,売上金額\n2026-04-01,12,18400\n2026-04-02,8,11200\n2026-04-03,15,23800`,
    csvHint: '形式: 日付（YYYY-MM-DD）, 注文数, 売上金額（円）\n英語ヘッダー（Date, Orders, Subtotal）も自動変換します',
  },
  menu: {
    label: 'menu',
    icon: '🍽️',
    color: '#FF4D4D',
    bg: '#fff5f5',
    accent: '#c0392b',
    api: '/api/sales/menu-sync',
    dashboardUrl: 'https://partner.menu.jp/',
    steps: [
      'menu パートナーポータルにログイン',
      '「レポート」→「売上レポート」を選択',
      '対象期間を選んで「CSVダウンロード」',
      'ダウンロードしたファイルを下にドロップ、またはCSV内容を貼り付け',
    ],
    sampleCsv: `日付,注文数,売上金額\n2026-04-01,5,7500\n2026-04-02,3,4200\n2026-04-03,8,12000`,
    csvHint: '形式: 日付（YYYY-MM-DD）, 注文数, 売上金額（円）\nタブ区切りCSVにも対応しています',
  },
} as const

export default function DeliveryImportClient() {
  const [service, setService] = useState<Service>('uber')
  const [csv, setCsv] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cfg = SERVICE_CONFIG[service]

  // サービス切替時にリセット
  const switchService = (s: Service) => {
    setService(s)
    setCsv('')
    setResult(null)
    setError(null)
  }

  // ファイル読み込み
  const loadFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      setError('CSVファイル（.csv / .txt / .tsv）を選択してください')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsv(text)
      setError(null)
      setResult(null)
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  // ドロップ処理
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }, [loadFile])

  // 取込実行
  const handleImport = async () => {
    if (!csv.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(cfg.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error + (data.hint ? `\n${data.hint}` : ''))
      } else {
        setResult(data)
        setCsv('')
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return (
    <div className="px-4 pt-4 space-y-4 pb-4">

      {/* サービス切替タブ */}
      <div className="flex gap-2">
        {(['uber', 'menu'] as Service[]).map(s => {
          const c = SERVICE_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => switchService(s)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border-2 transition-all"
              style={service === s
                ? { background: c.color, borderColor: c.color, color: 'white' }
                : { background: 'white', borderColor: '#E5E7EB', color: '#6B7280' }
              }
            >
              <span className="text-lg">{c.icon}</span>
              {c.label}
            </button>
          )
        })}
      </div>

      {/* 手順説明 */}
      <div
        className="rounded-xl p-4"
        style={{ background: cfg.bg, border: `1px solid ${cfg.color}33` }}
      >
        <p className="text-sm font-bold mb-2" style={{ color: cfg.accent }}>
          📋 {cfg.label} 取込手順
        </p>
        <ol className="text-sm space-y-1 list-decimal list-inside" style={{ color: cfg.accent }}>
          {cfg.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <a
          href={cfg.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs font-bold underline"
          style={{ color: cfg.accent }}
        >
          → {cfg.label} ダッシュボードを開く ↗
        </a>
      </div>

      {/* ファイルドロップ＋貼り付けエリア */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-bold text-gray-700">
            CSVファイルをドロップ、または内容を貼り付け
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600"
            >
              📁 ファイル選択
            </button>
            <button
              onClick={() => { setCsv(cfg.sampleCsv); setResult(null); setError(null) }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border text-orange-600"
              style={{ borderColor: '#fdba74' }}
            >
              サンプル
            </button>
          </div>
        </div>

        {/* 非表示ファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }}
        />

        {/* ドロップゾーン */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className="rounded-2xl border-2 border-dashed transition-all"
          style={{
            borderColor: isDragging ? cfg.color : csv ? '#d1fae5' : '#D1D5DB',
            background: isDragging ? `${cfg.color}0d` : csv ? '#f0fdf4' : 'white',
          }}
        >
          {csv ? (
            <div className="relative">
              <textarea
                value={csv}
                onChange={e => { setCsv(e.target.value); setResult(null); setError(null) }}
                rows={8}
                className="w-full px-4 py-3 text-sm font-mono resize-none focus:outline-none bg-transparent rounded-2xl"
              />
              <button
                onClick={() => setCsv('')}
                className="absolute top-2 right-2 text-xs text-gray-400 hover:text-red-400 bg-white border border-gray-200 rounded-lg px-2 py-1"
              >
                ✕ クリア
              </button>
            </div>
          ) : (
            <div
              className="py-12 text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-4xl mb-2">📂</p>
              <p className="text-sm font-bold text-gray-500">
                CSVファイルをここにドロップ
              </p>
              <p className="text-xs text-gray-400 mt-1">または「ファイル選択」ボタンで選択</p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-1.5 whitespace-pre-line">{cfg.csvHint}</p>
      </div>

      {/* 取込ボタン */}
      <button
        onClick={handleImport}
        disabled={loading || !csv.trim()}
        className="w-full font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:scale-95 transition-all text-white"
        style={{ background: csv.trim() ? cfg.color : '#9CA3AF' }}
      >
        {loading ? '⏳ 取込中...' : `📥 ${cfg.label} 売上を取込む`}
      </button>

      {/* 結果表示 */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-green-800 mb-1">✅ 取込完了</p>
          <p className="text-sm text-green-700">
            {result.updated}日分の{cfg.label}売上をシステムに反映しました
          </p>
          {result.dates.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {result.dates.map(d => (
                <span key={d} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{d}</span>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-xs font-bold text-red-700">エラー:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <a
            href="/dashboard/pl"
            className="inline-block mt-3 text-xs font-bold text-green-700 underline"
          >
            → PLページで確認する
          </a>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-800">⚠️ エラー</p>
          <p className="text-sm text-red-700 whitespace-pre-line mt-1">{error}</p>
        </div>
      )}

      {/* 自動化の案内 */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-sm font-bold text-gray-700 mb-1">🤖 自動化について</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          現在は手動CSV取込です。Playwrightによる自動ダウンロード機能を設定すると、
          毎朝9時に前日分を自動取込できます。設定方法は管理者にお問い合わせください。
        </p>
      </div>
    </div>
  )
}
