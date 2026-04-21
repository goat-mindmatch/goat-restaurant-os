export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import ManualClient from './ManualClient'

export default function ManualPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">📖 まぜそばマニュアル</h1>
        <p className="text-sm text-gray-500">人類みなまぜそば — スタッフ向け業務手順書</p>
      </div>
      <ManualClient />
      <DashboardNav current="/dashboard/manual" />
    </main>
  )
}
