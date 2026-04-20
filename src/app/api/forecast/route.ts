/**
 * GET /api/forecast
 * 来週7日分の売上予測 + AIコメント生成
 * モデル: claude-haiku-4-5-20251001
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
const GROWTH_RATE = 1.05

export type ForecastDay = {
  date: string            // YYYY-MM-DD
  dayLabel: string        // 月〜日
  predictedSales: number
  requiredStaff: number
  pastAvg: number
  pastMax: number
  pastMin: number
}

export type HeatmapRow = {
  dayName: string
  avg: number
  max: number
  min: number
  count: number
}

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 過去12週分のdaily_salesを取得
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  const from = twelveWeeksAgo.toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: salesData } = await db
    .from('daily_sales')
    .select('date, total_sales')
    .eq('tenant_id', TENANT_ID)
    .gte('date', from)
    .lte('date', today)
    .order('date', { ascending: true }) as {
      data: Array<{ date: string; total_sales: number }> | null
    }

  // 曜日別集計
  const byDow: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const row of (salesData ?? [])) {
    const dow = new Date(row.date).getDay()
    byDow[dow].push(row.total_sales)
  }

  const heatmap: HeatmapRow[] = DAY_NAMES.map((name, dow) => {
    const vals = byDow[dow]
    if (vals.length === 0) return { dayName: name, avg: 0, max: 0, min: 0, count: 0 }
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return {
      dayName: name,
      avg: Math.round(avg),
      max: Math.max(...vals),
      min: Math.min(...vals),
      count: vals.length,
    }
  })

  // 来週7日分の予測
  const nextMonday = new Date()
  const dayOfWeek = nextMonday.getDay() === 0 ? 7 : nextMonday.getDay()
  nextMonday.setDate(nextMonday.getDate() + (8 - dayOfWeek))

  const forecast: ForecastDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday)
    d.setDate(nextMonday.getDate() + i)
    const dow = d.getDay()
    const dateStr = d.toISOString().split('T')[0]
    const heat = heatmap[dow]
    const predictedSales = Math.round(heat.avg * GROWTH_RATE)
    const requiredStaff = predictedSales > 0 ? Math.max(1, Math.ceil(predictedSales / 30000)) : 1
    forecast.push({
      date: dateStr,
      dayLabel: DAY_NAMES[dow],
      predictedSales,
      requiredStaff,
      pastAvg: heat.avg,
      pastMax: heat.max,
      pastMin: heat.min,
    })
  }

  // AIコメント
  let aiComment = ''
  try {
    const prompt = `飲食店の来週売上予測データを踏まえ、なぜ特定曜日が多い・少ないか、来週の準備で注意すべきことを200字以内の日本語でコメントしてください。

曜日別過去平均売上（円）:
${heatmap.map(h => `${h.dayName}曜: ¥${h.avg.toLocaleString()}（${h.count}週分）`).join('\n')}

来週予測（5%成長率込み）:
${forecast.map(f => `${f.date}(${f.dayLabel}) ¥${f.predictedSales.toLocaleString()} スタッフ${f.requiredStaff}名`).join('\n')}`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    aiComment = msg.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
  } catch (e) {
    console.error('[forecast AI]', e)
    aiComment = '予測データを確認し、ピーク日は余裕を持ったシフトを組んでください。'
  }

  return NextResponse.json({ forecast, heatmap, aiComment })
}
