/**
 * 設定ページ
 * LINEリッチメニュー等の管理者設定
 */
export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import SettingsClient from './SettingsClient'

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500">管理者設定</p>
      </div>

      {/* LINEリッチメニュー設定 */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">LINEリッチメニュー</h2>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-600 mb-4">
            スタッフ用LINEのリッチメニュー（操作パネル）をAPIで自動設定します。
            ボタンの画像は別途LINE Official Account Managerでアップロードしてください。
          </p>
          <SettingsClient />
        </div>
      </section>

      <DashboardNav current="/dashboard/settings" />
    </main>
  )
}
