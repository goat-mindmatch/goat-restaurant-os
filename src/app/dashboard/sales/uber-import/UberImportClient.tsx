'use client'

import { useState } from 'react'

const SAMPLE_CSV = `日付,注文数,売上金額
2026-04-01,12,18400
2026-04-02,8,11200
2026-04-03,15,23800`

export default function UberImportClient() {
  const [csv, setCsv] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ updated: number; errors: string[]; dates: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!csv.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/sales/uber-sync', {
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
    <div className="px-4 pt-4 space-y-4">

      {/* 手順説明 */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm font-bold text-orange-800 mb-2">📋 取込手順</p>
        <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
          <li>Uber Eats レストランダッシュボードを開く</li>
          <li>「分析」→「注文レポート」からCSVをダウンロード</li>
          <li>CSVの内容をそのまま下のボックスに貼り付ける</li>
          <li>「取込実行」ボタンを押す</li>
        </ol>
      </div>

      {/* CSV入力 */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-bold text-gray-700">CSVを貼り付け</label>
          <button
            onClick={() => setCsv(SAMPLE_CSV)}
            className="text-xs text-orange-600 underline"
          >
            サンプルを挿入
          </button>
        </div>
        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          placeholder={`日付,注文数,売上金額\n2026-04-01,12,18400\n2026-04-02,8,11200`}
          rows={10}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        <p className="text-xs text-gray-400 mt-1">
          形式: 日付（YYYY-MM-DD）, 注文数, 売上金額（円）
        </p>
      </div>

      {/* 実行ボタン */}
      <button
        onClick={handleImport}
        disabled={loading || !csv.trim()}
        className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl text-base disabled:opacity-40 active:scale-95 transition-transform"
      >
        {loading ? '⏳ 取込中...' : '📥 取込実行'}
      </button>

      {/* 結果表示 */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-bold text-green-800 mb-2">✅ 取込完了</p>
          <p className="text-sm text-green-700">{result.updated}日分のUber Eats売上を反映しました</p>
          {result.dates.length > 0 && (
            <p className="text-xs text-green-600 mt-1">対象日: {result.dates.join(', ')}</p>
          )}
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold text-red-700">エラー:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-800">⚠️ エラー</p>
          <p className="text-sm text-red-700 whitespace-pre-line mt-1">{error}</p>
        </div>
      )}

      {/* 注意書き */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-600 mb-1">💡 よくある形式</p>
        <p className="text-xs text-gray-500">
          Uber EatsのCSVは「Date, Orders, Subtotal」という英語ヘッダーの場合があります。
          その場合もそのまま貼り付けてOKです（自動変換します）。
        </p>
        <p className="text-xs text-gray-500 mt-1">
          取込後は <a href="/dashboard/pl" className="text-orange-600 underline">PLページ</a> でUber Eats売上が反映されていることを確認してください。
        </p>
      </div>
    </div>
  )
}
