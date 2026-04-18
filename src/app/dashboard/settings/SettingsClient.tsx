'use client'

import { useState } from 'react'

export default function SettingsClient() {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function handleSetupRichMenu() {
    setLoading(true)
    setToast(null)

    try {
      const res = await fetch('/api/line/setup-richmenu', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; richMenuId?: string; error?: string }

      if (res.ok && data.ok) {
        setToast({ type: 'success', message: '✅ リッチメニューを設定しました！LINEアプリで確認してください' })
      } else {
        setToast({ type: 'error', message: `❌ 設定に失敗しました: ${data.error ?? '不明なエラー'}` })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '不明なエラー'
      setToast({ type: 'error', message: `❌ 設定に失敗しました: ${message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* トースト通知 */}
      {toast && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 設定ボタン */}
      <button
        onClick={handleSetupRichMenu}
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
      >
        {loading ? '設定中...' : '📱 LINEリッチメニューを設定する'}
      </button>

      {/* 手順説明 */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">設定手順</p>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>このボタンを押すとスタッフLINEにメニューが表示されます</li>
          <li>ボタンの画像はLINE Official Account Managerでアップロードしてください</li>
          <li>
            現在のボタン:
            <span className="ml-1 inline-flex flex-wrap gap-1 mt-1">
              {['出勤', '退勤', 'シフト希望', '発注依頼', 'シフト確認', 'ヘルプ'].map((label) => (
                <span
                  key={label}
                  className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
                >
                  {label}
                </span>
              ))}
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}
