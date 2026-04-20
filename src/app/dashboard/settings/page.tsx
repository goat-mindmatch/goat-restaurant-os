/**
 * 設定ページ
 * 店舗設定 / スタッフ管理 / LINE設定
 */
export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import SettingsClient from './SettingsClient'

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* ヘッダー */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500">店舗・スタッフ・LINE管理</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm">
        <SettingsClient />
      </div>

      <DashboardNav current="/dashboard/settings" />
    </main>
  )
}
