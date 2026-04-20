export const dynamic = 'force-dynamic'

/**
 * お客様向けモバイルオーダーページ
 * URL: /menu?table=1
 * テーブルのQRコードからアクセス
 */

import { createServiceClient } from '@/lib/supabase'
import MenuClient from './MenuClient'

const TENANT_ID = process.env.TENANT_ID!

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; lang?: string }>
}) {
  const { table, lang } = await searchParams
  const tableNumber = Number(table)
  const language = (lang === 'en' || lang === 'zh') ? lang : 'ja'

  if (!table || isNaN(tableNumber) || tableNumber < 1) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-sm w-full">
          <p className="text-5xl mb-4">🪑</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">テーブルが特定できません</h2>
          <p className="text-sm text-gray-500">
            テーブルに貼ってあるQRコードを<br />再度読み取ってください
          </p>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data: items } = await db
    .from('menu_items')
    .select('id, name, description, price, category, image_url, sort_order, name_en, name_zh, description_en, description_zh')
    .eq('tenant_id', TENANT_ID)
    .eq('is_available', true)
    .order('sort_order')

  return <MenuClient tableNumber={tableNumber} items={items ?? []} initialLang={language} />
}
