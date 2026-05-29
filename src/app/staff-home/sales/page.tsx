export const dynamic = 'force-dynamic'

/**
 * /staff-home/sales
 * スタッフ・経営者共通の「本日の売上ダッシュボード」
 * - 15時時点: 昼売上＋判定
 * - 21時時点: 総売上＋夜売上＋判定
 * - スタッフ飯入力＋月集計
 * - 月次フォーマットの報告文を1タップでコピー
 */

import SalesDashboardClient from './SalesDashboardClient'

export default function StaffSalesPage() {
  return <SalesDashboardClient />
}
