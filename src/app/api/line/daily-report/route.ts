export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/line/daily-report?secret=xxx
 * cronから毎日23:00に実行
 * 今日の営業終了レポートを manager/owner ロールのスタッフにFlex Messageで送信
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendFlexMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET
const DASHBOARD_URL = 'https://goat-restaurant-os.vercel.app/dashboard/pl'

const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

function pctChange(current: number, prev: number): { diff: number; arrow: string } {
  if (prev === 0) return { diff: current > 0 ? 100 : 0, arrow: current > 0 ? '↑' : '→' }
  const diff = Math.round(((current - prev) / prev) * 100)
  return { diff, arrow: diff >= 0 ? '↑' : '↓' }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  try {
    // 今日（JST）
    const nowJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const todayISO = nowJST.toISOString().split('T')[0]
    const todayDow = nowJST.getDay()
    const todayDisplay = `${nowJST.getMonth() + 1}月${nowJST.getDate()}日(${WEEKDAYS_JP[todayDow]})`

    // 先週同曜日
    const lastWeekDate = new Date(nowJST)
    lastWeekDate.setDate(lastWeekDate.getDate() - 7)
    const lastWeekISO = lastWeekDate.toISOString().split('T')[0]

    // 今月の初日
    const firstDayOfMonth = `${todayISO.slice(0, 7)}-01`
    const daysInMonth = new Date(nowJST.getFullYear(), nowJST.getMonth() + 1, 0).getDate()

    // データ並列取得
    const [
      todaySalesRes,
      ordersRes,
      reviewsRes,
      lastWeekSalesRes,
      monthSalesRes,
      tenantRes,
    ] = await Promise.all([
      // 今日の売上
      db.from('daily_sales')
        .select('total_sales, store_orders, delivery_orders')
        .eq('tenant_id', TENANT_ID)
        .eq('date', todayISO)
        .single(),
      // 今日の注文（customer_orders）
      db.from('customer_orders')
        .select('id, total_amount')
        .eq('tenant_id', TENANT_ID)
        .eq('status', 'served')
        .gte('created_at', `${todayISO}T00:00:00`)
        .lte('created_at', `${todayISO}T23:59:59`),
      // 今日のスタッフ別口コミ
      db.from('review_submissions')
        .select('staff_id, staff:staff(name)')
        .eq('tenant_id', TENANT_ID)
        .eq('verified', true)
        .gte('created_at', `${todayISO}T00:00:00`)
        .lte('created_at', `${todayISO}T23:59:59`),
      // 先週同曜日の売上
      db.from('daily_sales')
        .select('total_sales')
        .eq('tenant_id', TENANT_ID)
        .eq('date', lastWeekISO)
        .single(),
      // 今月累計
      db.from('daily_sales')
        .select('total_sales')
        .eq('tenant_id', TENANT_ID)
        .gte('date', firstDayOfMonth)
        .lte('date', todayISO),
      // テナント設定（月間目標）
      db.from('tenants')
        .select('monthly_target, name')
        .eq('id', TENANT_ID)
        .single(),
    ])

    const todaySales = todaySalesRes.data
    const orders = ordersRes.data ?? []
    const reviews = reviewsRes.data ?? []
    const lastWeekSales = lastWeekSalesRes.data
    const monthSalesRows = monthSalesRes.data ?? []
    const tenant = tenantRes.data

    // 売上集計
    // customer_ordersが空の場合はdaily_salesにフォールバック
    let totalRevenue: number
    let orderCount: number

    if (orders.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount ?? 0), 0)
      orderCount = orders.length
    } else {
      totalRevenue = todaySales?.total_sales ?? 0
      orderCount = (todaySales?.store_orders ?? 0) + (todaySales?.delivery_orders ?? 0)
    }

    const avgPrice = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0

    // 先週比
    const lastWeekRevenue = lastWeekSales?.total_sales ?? 0
    const { diff, arrow } = pctChange(totalRevenue, lastWeekRevenue)
    const diffSign = diff >= 0 ? '+' : ''
    const diffColor = diff >= 0 ? '#059669' : '#DC2626'

    // 今月累計
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthTotal = monthSalesRows.reduce((sum: number, r: any) => sum + (r.total_sales ?? 0), 0)

    // 日割り目標
    const monthlyTarget = tenant?.monthly_target ?? 0
    const dailyTarget = monthlyTarget > 0 ? Math.round(monthlyTarget / daysInMonth) : 0
    const achieveRate = dailyTarget > 0 ? Math.round((totalRevenue / dailyTarget) * 100) : null
    const achieveEmoji = achieveRate !== null ? (achieveRate >= 100 ? '🎉' : '😤') : ''

    // スタッフ別口コミランキング
    const reviewCountByStaff: Record<string, { name: string; count: number }> = {}
    for (const r of reviews) {
      const staffId = r.staff_id as string
      const name = (r.staff as { name: string } | null)?.name ?? '不明'
      if (!reviewCountByStaff[staffId]) {
        reviewCountByStaff[staffId] = { name, count: 0 }
      }
      reviewCountByStaff[staffId].count++
    }

    const reviewRanking = Object.values(reviewCountByStaff)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    const RANK_MEDALS = ['🥇', '🥈', '🥉']

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewContents: Record<string, any>[] = reviewRanking.length > 0
      ? reviewRanking.map((s, i) => ({
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: `${RANK_MEDALS[i]} ${i + 1}位`, size: 'sm', color: '#555555', flex: 2 },
            { type: 'text', text: s.name, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 3 },
            { type: 'text', text: `${s.count}件`, size: 'sm', weight: 'bold', color: '#DC2626', flex: 1, align: 'end' },
          ],
        }))
      : [{ type: 'text', text: '本日の口コミ獲得なし', size: 'sm', color: '#888888', align: 'center' }]

    // Flex Message 組み立て
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodyContents: Record<string, any>[] = [
      // ブロック1: 売上
      {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '📊 売上',
            size: 'sm',
            weight: 'bold',
            color: '#0f172a',
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '売上合計', size: 'sm', color: '#555555', flex: 3 },
              { type: 'text', text: `¥${totalRevenue.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '客数', size: 'sm', color: '#555555', flex: 3 },
              { type: 'text', text: `${orderCount}組`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '平均単価', size: 'sm', color: '#555555', flex: 3 },
              { type: 'text', text: `¥${avgPrice.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '先週同曜日比', size: 'sm', color: '#555555', flex: 3 },
              {
                type: 'text',
                text: lastWeekRevenue > 0 ? `${diffSign}${diff}% ${arrow}` : 'データなし',
                size: 'sm',
                weight: 'bold',
                color: lastWeekRevenue > 0 ? diffColor : '#888888',
                flex: 2,
                align: 'end',
              },
            ],
          },
        ],
      },
      { type: 'separator', margin: 'md' },
      // ブロック2: スタッフ口コミ
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '⭐ スタッフ口コミ',
            size: 'sm',
            weight: 'bold',
            color: '#0f172a',
          },
          ...reviewContents,
        ],
      },
      { type: 'separator', margin: 'md' },
      // ブロック3: 目標達成
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '🎯 目標達成',
            size: 'sm',
            weight: 'bold',
            color: '#0f172a',
          },
          ...(dailyTarget > 0
            ? [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '日次目標', size: 'sm', color: '#555555', flex: 3 },
                    { type: 'text', text: `¥${dailyTarget.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
                  ],
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '達成率', size: 'sm', color: '#555555', flex: 3 },
                    {
                      type: 'text',
                      text: `${achieveRate}% ${achieveEmoji}`,
                      size: 'sm',
                      weight: 'bold',
                      color: (achieveRate ?? 0) >= 100 ? '#059669' : '#DC2626',
                      flex: 2,
                      align: 'end',
                    },
                  ],
                },
              ]
            : [{ type: 'text', text: '月間目標が未設定です', size: 'sm', color: '#888888' }]),
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '今月累計', size: 'sm', color: '#555555', flex: 3 },
              { type: 'text', text: `¥${monthTotal.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
            ],
          },
        ],
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flexContents: Record<string, any> = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0f172a',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🌙 本日の営業終了レポート',
            color: '#ffffff',
            weight: 'bold',
            size: 'md',
          },
          {
            type: 'text',
            text: todayDisplay,
            color: '#94a3b8',
            size: 'sm',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'md',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0f172a',
            action: {
              type: 'uri',
              label: '📈 PLを確認する',
              uri: DASHBOARD_URL,
            },
            height: 'md',
          },
        ],
      },
    }

    // manager/owner ロールのスタッフ取得
    const { data: managers } = await db
      .from('staff')
      .select('line_user_id, name, role')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .in('role', ['manager', 'owner'])
      .not('line_user_id', 'is', null)

    const recipients = managers ?? []
    const results: { name: string; status: string }[] = []

    for (const m of recipients) {
      try {
        await sendFlexMessage(
          m.line_user_id,
          `🌙 ${todayDisplay} 営業終了レポート - 売上¥${totalRevenue.toLocaleString()}`,
          flexContents
        )
        results.push({ name: m.name, status: 'sent' })
      } catch (e) {
        console.error(`Failed to send daily report to ${m.name}:`, e)
        results.push({ name: m.name, status: `error: ${(e as Error).message}` })
      }
    }

    return NextResponse.json({
      ok: true,
      date: todayISO,
      totalRevenue,
      orderCount,
      achieveRate,
      sent: results.filter(r => r.status === 'sent').length,
      total: results.length,
      results,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
