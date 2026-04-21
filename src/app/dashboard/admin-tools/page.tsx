export const dynamic = 'force-dynamic'

/**
 * 管理者ツール — 内部APIを安全に実行するダッシュボード
 * CRON_SECRETはサーバー側で処理。URLには一切露出しない。
 */

import DashboardNav from '@/components/DashboardNav'
import AdminToolsClient from './AdminToolsClient'

export default function AdminToolsPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">🛠️ 管理者ツール</h1>
        <p className="text-sm text-gray-500">週次レポート・AI分析・給与明細などを手動実行</p>
      </div>
      <AdminToolsClient />
      <DashboardNav current="/dashboard/admin-tools" />
    </main>
  )
}
