/**
 * GET /api/reports/weekly?secret={CRON_SECRET}
 * 週次AIレポートをmanagerスタッフのLINEへFlex Message送信
 * モデル: claude-haiku-4-5-20251001
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { sendFlexMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getLastWeekRange() {
  const now = new Date()
  // 今週月曜
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - dayOfWeek + 1)
  // 先週月曜〜日曜
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday)
  lastSunday.setDate(thisMonday.getDate() - 1)
  // 前々週月曜〜日曜
  const prevMonday = new Date(lastMonday)
  prevMonday.setDate(lastMonday.getDate() - 7)
  const prevSunday = new Date(lastMonday)
  prevSunday.setDate(lastMonday.getDate() - 1)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return {
    lastFrom: fmt(lastMonday),
    lastTo: fmt(lastSunday),
    prevFrom: fmt(prevMonday),
    prevTo: fmt(prevSunday),
    label: `${lastMonday.getMonth() + 1}/${lastMonday.getDate()}〜${lastSunday.getMonth() + 1}/${lastSunday.getDate()}`,
  }
}

export async function GET(req: NextRequest) {
  // CRON_SECRET 認証
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const range = getLastWeekRange()

  // 先週・前々週の売上集計
  const [lastWeekRes, prevWeekRes, staffRes, reviewRes] = await Promise.all([
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', range.lastFrom)
      .lte('date', range.lastTo),
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', range.prevFrom)
      .lte('date', range.prevTo),
    db.from('staff')
      .select('id, name, line_user_id, role')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true),
    db.from('review_submissions')
      .select('staff_id, staff:staff_id(name)')
      .eq('tenant_id', TENANT_ID)
      .gte('created_at', range.lastFrom + 'T00:00:00')
      .lte('created_at', range.lastTo + 'T23:59:59'),
  ])

  const lastWeekSales: number = (lastWeekRes.data ?? []).reduce((s: number, r: { total_sales: number }) => s + (r.total_sales ?? 0), 0)
  const prevWeekSales: number = (prevWeekRes.data ?? []).reduce((s: number, r: { total_sales: number }) => s + (r.total_sales ?? 0), 0)
  const salesChangeRate = prevWeekSales > 0 ? ((lastWeekSales - prevWeekSales) / prevWeekSales) * 100 : 0

  // 人気メニューTop3（order_itemsから）
  const orderItemsRes = await db
    .from('order_items')
    .select('menu_item_id, quantity, menu_items!inner(name), customer_orders!inner(created_at, tenant_id, status)')
    .eq('customer_orders.tenant_id', TENANT_ID)
    .eq('customer_orders.status', 'paid')
    .gte('customer_orders.created_at', range.lastFrom + 'T00:00:00')
    .lte('customer_orders.created_at', range.lastTo + 'T23:59:59')

  const menuCountMap: Record<string, { name: string; count: number }> = {}
  for (const oi of (orderItemsRes.data ?? [])) {
    const id = oi.menu_item_id
    const menuName = oi.menu_items?.name ?? '不明'
    if (!menuCountMap[id]) menuCountMap[id] = { name: menuName, count: 0 }
    menuCountMap[id].count += oi.quantity
  }
  const top3 = Object.values(menuCountMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // 最多口コミスタッフ
  const reviewCountMap: Record<string, { name: string; count: number }> = {}
  for (const r of (reviewRes.data ?? [])) {
    const id = r.staff_id
    const name = r.staff?.name ?? '不明'
    if (!reviewCountMap[id]) reviewCountMap[id] = { name, count: 0 }
    reviewCountMap[id].count++
  }
  const mvpStaff = Object.values(reviewCountMap).sort((a, b) => b.count - a.count)[0]

  // AI分析テキスト生成
  const prompt = `飲食店の週次経営データを分析し、要注意ポイントと来週の提案をそれぞれ1文で日本語で答えてください。

先週売上: ¥${lastWeekSales.toLocaleString()}（前週比${salesChangeRate >= 0 ? '+' : ''}${salesChangeRate.toFixed(1)}%）
人気メニューTop3: ${top3.map((m, i) => `${i + 1}.${m.name}(${m.count}件)`).join('、')}
MVP スタッフ: ${mvpStaff ? `${mvpStaff.name}（口コミ${mvpStaff.count}件）` : 'なし'}

以下の形式で回答してください（JSON）:
{"warning": "要注意ポイント（50字以内）", "suggestion": "来週の提案（50字以内）"}`

  let warning = '先週比データを分析し経営状況を確認してください'
  let suggestion = 'スタッフとのコミュニケーションを大切に'

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      warning = parsed.warning ?? warning
      suggestion = parsed.suggestion ?? suggestion
    }
  } catch (e) {
    console.error('[weekly report AI]', e)
  }

  // managerスタッフにLINE送信
  const managers = (staffRes.data ?? []).filter(
    (s: { role: string; line_user_id: string | null }) => s.role === 'manager' && s.line_user_id
  )

  const flexContents = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1e3a5f',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '📊 今週の経営レポート', color: '#ffffff', size: 'md', weight: 'bold' },
        { type: 'text', text: range.label, color: '#93c5fd', size: 'xs', margin: 'xs' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'md',
      contents: [
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: '売上合計', size: 'sm', color: '#6b7280', flex: 1 },
            {
              type: 'box', layout: 'horizontal', flex: 2, justifyContent: 'flex-end',
              contents: [
                { type: 'text', text: `¥${lastWeekSales.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#111827' },
                {
                  type: 'text',
                  text: ` (先週比${salesChangeRate >= 0 ? '+' : ''}${salesChangeRate.toFixed(1)}%)`,
                  size: 'xs',
                  color: salesChangeRate >= 0 ? '#16a34a' : '#dc2626',
                  margin: 'xs',
                },
              ],
            },
          ],
        },
        { type: 'separator' },
        { type: 'text', text: '🍜 人気メニューTop3', size: 'sm', weight: 'bold', color: '#374151' },
        ...top3.map((m, i) => ({
          type: 'text' as const,
          text: `${i + 1}. ${m.name}（${m.count}件）`,
          size: 'sm' as const,
          color: '#4b5563',
          margin: 'xs' as const,
        })),
        { type: 'separator' },
        {
          type: 'text',
          text: `🏆 MVP: ${mvpStaff ? `${mvpStaff.name}（口コミ${mvpStaff.count}件）` : 'データなし'}`,
          size: 'sm',
          color: '#374151',
        },
        { type: 'separator' },
        { type: 'text', text: `⚠️ ${warning}`, size: 'sm', color: '#b45309', wrap: true },
        { type: 'text', text: `💡 ${suggestion}`, size: 'sm', color: '#1d4ed8', wrap: true, margin: 'xs' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1e3a5f',
          action: {
            type: 'uri',
            label: '詳細PLを見る',
            uri: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://goat-restaurant-os.vercel.app'}/dashboard/pl`,
          },
          height: 'sm',
        },
      ],
    },
  }

  const errors: string[] = []
  const sent: string[] = []

  for (const manager of managers) {
    try {
      await sendFlexMessage(
        manager.line_user_id as string,
        `📊 週次経営レポート ${range.label}`,
        flexContents
      )
      sent.push(manager.name)
    } catch (e) {
      errors.push(`${manager.name}: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return NextResponse.json({
    ok: true,
    range,
    lastWeekSales,
    prevWeekSales,
    salesChangeRate: `${salesChangeRate.toFixed(1)}%`,
    top3,
    mvpStaff,
    warning,
    suggestion,
    sent,
    errors,
  })
}
