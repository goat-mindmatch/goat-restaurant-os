export const dynamic = 'force-dynamic'

/**
 * /staff-home/delivery-input
 * Uber Eats / RocketNow の売上を現場が「確認して入力するだけ」で反映する画面。
 * 新ポータルが自動取得不可になったための手動入力アシスト。
 */

import DeliveryInputClient from './DeliveryInputClient'

export default function DeliveryInputPage() {
  return <DeliveryInputClient />
}
