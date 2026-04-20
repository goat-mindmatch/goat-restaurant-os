export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import UberImportClient from './UberImportClient'

export default function UberImportPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Uber Eats 売上取込</h1>
        <p className="text-sm text-gray-500">CSVを貼り付けて売上データを自動反映</p>
      </div>
      <UberImportClient />
      <DashboardNav current="/dashboard/sales" />
    </main>
  )
}
