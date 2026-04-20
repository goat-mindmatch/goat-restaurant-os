export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 今日のミッション LINE Flex Message 一斉送信
 * POST /api/line/send-mission
 *
 * 処理:
 *  1. daily_sales から先週同曜日の売上を取得して目標算出（+10%、なければ100,000円）
 *  2. attendance から今日の出勤スタッフを取得
 *  3. review_submissions から今月のランキングを計算
 *  4. 各スタッフの line_user_id に Flex Message 送信
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendFlexMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!

export async function POST() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const todayStr = jst.toISOString().split('T')[0]
  const monthStart = todayStr.slice(0, 7) + '-01'

  // 先週同曜日
  const lastWeekDate = new Date(jst)
  lastWeekDate.setDate(lastWeekDate.getDate() - 7)
  const lastWeekStr = lastWeekDate.toISOString().split('T')[0]

  // 1. 今月の日別売上 + 先週同曜日の売上
  const [monthlySalesRes, lastWeekSalesRes, todayAttendanceRes, reviewsRes] = await Promise.all([
    db.from('daily_sales')
      .select('date, total_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', monthStart)
      .lte('date', todayStr)
      .order('date', { ascending: true }),
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', lastWeekStr)
      .single(),
    db.from('attendance')
      .select('staff_id, clock_in')
      .eq('tenant_id', TENANT_ID)
      .eq('date', todayStr),
    db.from('review_submissions')
      .select('staff_id, staff:staff!review_submissions_staff_id_fkey(name)')
      .eq('tenant_id', TENANT_ID)
      .eq('verified', true)
      .gte('created_at', `${monthStart}T00:00:00`)
      .lte('created_at', `${todayStr}T23:59:59`),
  ])

  // 目標売上算出
  const lastWeekSales: number = lastWeekSalesRes.data?.total_sales ?? 0
  const targetRevenue = lastWeekSales > 0 ? Math.round(lastWeekSales * 1.1) : 100000

  // 今日の売上累計（今日分があれば）
  const monthlySales: { date: string; total_sales: number }[] = monthlySalesRes.data ?? []
  const todaySalesData = monthlySales.find((r) => r.date === todayStr)
  const currentSales = todaySalesData?.total_sales ?? 0

  // 口コミランキング（今月）
  const reviewCountMap: Record<string, { name: string; count: number }> = {}
  for (const r of (reviewsRes.data ?? [])) {
    const sid = r.staff_id
    if (!sid) continue
    const name = (r.staff as { name: string } | null)?.name ?? '不明'
    if (!reviewCountMap[sid]) reviewCountMap[sid] = { name, count: 0 }
    reviewCountMap[sid].count++
  }
  const reviewRanking = Object.values(reviewCountMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // 出勤スタッフ (line_user_id を取得)
  const attendingStaffIds: string[] = (todayAttendanceRes.data ?? [])
    .filter((a: { clock_in: string | null }) => a.clock_in)
    .map((a: { staff_id: string }) => a.staff_id)

  if (attendingStaffIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: '出勤スタッフなし' })
  }

  const { data: staffRows } = await db.from('staff')
    .select('id, name, line_user_id')
    .eq('tenant_id', TENANT_ID)
    .in('id', attendingStaffIds)

  const staffWithLine: { id: string; name: string; line_user_id: string }[] =
    (staffRows ?? []).filter((s: { line_user_id: string | null }) => s.line_user_id)

  // 進捗バー生成 (10マス)
  function buildProgressBar(current: number, target: number): string {
    const pct = Math.min(1, target > 0 ? current / target : 0)
    const filled = Math.round(pct * 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${Math.round(pct * 100)}%`
  }

  const progressBar = buildProgressBar(currentSales, targetRevenue)

  // ランキングテキスト行
  const rankMedals = ['🥇', '🥈', '🥉']
  const rankingContents = reviewRanking.length > 0
    ? reviewRanking.map((r, i) => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: rankMedals[i] ?? `${i + 1}.`, size: 'sm', flex: 1 },
          { type: 'text', text: r.name, size: 'sm', flex: 3, color: '#333333' },
          { type: 'text', text: `${r.count}件`, size: 'sm', flex: 2, align: 'end', color: '#DC2626', weight: 'bold' },
        ],
        margin: 'sm',
      }))
    : [{ type: 'text', text: '（まだ口コミなし）', size: 'sm', color: '#aaaaaa' }]

  // Flex Message 組み立て
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flexContents: Record<string, any> = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#EA580C',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: '🎯 今日のミッション',
          color: '#ffffff',
          weight: 'bold',
          size: 'xl',
        },
        {
          type: 'text',
          text: todayStr.replace(/-/g, '/'),
          color: '#FFD9C0',
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
      contents: [
        // 目標売上
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '🎯 目標売上', size: 'sm', color: '#555555', flex: 2 },
            {
              type: 'text',
              text: `¥${targetRevenue.toLocaleString()}`,
              size: 'sm',
              weight: 'bold',
              color: '#1a1a1a',
              flex: 3,
              align: 'end',
            },
          ],
        },
        // 現在売上
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '💴 現在売上', size: 'sm', color: '#555555', flex: 2 },
            {
              type: 'text',
              text: `¥${currentSales.toLocaleString()}`,
              size: 'sm',
              color: '#1a1a1a',
              flex: 3,
              align: 'end',
            },
          ],
        },
        // 進捗バー
        {
          type: 'text',
          text: progressBar,
          size: 'xs',
          color: '#EA580C',
          wrap: false,
          margin: 'xs',
        },
        { type: 'separator', margin: 'md' },
        // 口コミランキング
        {
          type: 'text',
          text: '⭐ 口コミランキング TOP3（今月）',
          size: 'sm',
          weight: 'bold',
          color: '#333333',
        },
        ...rankingContents,
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#EA580C',
          action: {
            type: 'uri',
            label: '📊 売上を確認',
            uri: 'https://goat-restaurant-os.vercel.app/dashboard',
          },
          height: 'sm',
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: '📅 シフト確認',
            uri: 'https://goat-restaurant-os.vercel.app/dashboard/shifts',
          },
          height: 'sm',
        },
      ],
    },
  }

  // 各スタッフに送信
  let sent = 0
  const errors: string[] = []
  await Promise.all(
    staffWithLine.map(async (s) => {
      try {
        await sendFlexMessage(
          s.line_user_id,
          `🎯 今日のミッション — 目標 ¥${targetRevenue.toLocaleString()}`,
          flexContents
        )
        sent++
      } catch (e) {
        errors.push(`${s.name}: ${String(e)}`)
      }
    })
  )

  return NextResponse.json({ ok: true, sent, errors: errors.length > 0 ? errors : undefined })
}
