export const dynamic = 'force-dynamic'

import DashboardNav from '@/components/DashboardNav'
import DeliveryImportClient from './DeliveryImportClient'

export default function DeliveryImportPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">🛵 デリバリー売上取込</h1>
        <p className="text-sm text-gray-500">Uber Eats・menu のCSVを自動反映</p>
      </div>
      <DeliveryImportClient />
      <DashboardNav current="/dashboard/sales/delivery-import" />
    </main>
  )
}
