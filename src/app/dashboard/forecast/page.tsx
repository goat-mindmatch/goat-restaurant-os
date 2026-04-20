/**
 * 混雑予測シフトAI ダッシュボード
 */
export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import ForecastClient from './ForecastClient'

export default function ForecastPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1">混雑予測シフトAI</h1>
        <p className="text-xs text-gray-500 mb-4">過去12週の売上データをもとに来週7日分を予測（5%成長率適用）</p>
        <ForecastClient />
      </div>
      <DashboardNav current="/dashboard/forecast" />
    </main>
  )
}
