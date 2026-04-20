/**
 * SNS自動投稿ダッシュボード
 */
export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import SNSClient from './SNSClient'

export default function SNSPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1">SNS自動投稿</h1>
        <p className="text-xs text-gray-500 mb-4">AIがキャプション・ハッシュタグを生成。Instagram / TikTok / X に対応予定</p>
        <SNSClient />
      </div>
      <DashboardNav current="/dashboard/sns" />
    </main>
  )
}
