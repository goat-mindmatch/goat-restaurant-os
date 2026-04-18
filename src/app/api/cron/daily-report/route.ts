export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/daily-report
 * Vercel Cronから毎朝8:30 JSTに呼ばれる（23:30 UTC前日）
 * - 昨日の日報を生成（先週比・先月比付き）
 * - 店長(role='manager')のLINEに配信
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const CRON_SECRET = process.env.CRON_SECRET

function dateOffset(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function pctChange(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? '+∞%' : '±0%'
  const pct = Math.round(((current - prev) / prev) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

export async function GET(req: NextRequest) {
  // Vercel Cron の認証（本番のみ）
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // 昨日の日付
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const target     = yesterday.toISOString().split('T')[0]
    const weekAgo    = dateOffset(yesterday, -7)   // 先週同曜日
    const monthAgo   = dateOffset(yesterday, -28)  // 先月同週（4週前）

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 各種データを並列取得
    const [salesRes, attendanceRes, monthSalesRes, weekAgoRes, monthAgoRes] = await Promise.all([
      db.from('daily_sales').select('*').eq('tenant_id', TENANT_ID).eq('date', target).single(),
      db.from('attendance').select('clock_in, clock_out, work_minutes, staff(name, hourly_wage)')
        .eq('tenant_id', TENANT_ID).eq('date', target),
      db.from('daily_sales').select('total_sales, food_cost, labor_cost')
        .eq('tenant_id', TENANT_ID)
        .gte('date', target.slice(0, 7) + '-01')
        .lte('date', target),
      db.from('daily_sales').select('total_sales, store_orders, delivery_orders')
        .eq('tenant_id', TENANT_ID).eq('date', weekAgo).single(),
      db.from('daily_sales').select('total_sales, store_orders, delivery_orders')
        .eq('tenant_id', TENANT_ID).eq('date', monthAgo).single(),
    ])

    const sales      = salesRes.data ?? null
    const attendance = attendanceRes.data ?? []
    const monthSales = monthSalesRes.data ?? []
    const weekAgoSales  = weekAgoRes.data ?? null
    const monthAgoSales = monthAgoRes.data ?? null

    // 人件費計算
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const laborCost = attendance.reduce((sum: number, a: any) => {
      if (!a.work_minutes || !a.staff?.hourly_wage) return sum
      return sum + Math.round((a.work_minutes / 60) * a.staff.hourly_wage)
    }, 0)

    const todaySales    = sales?.total_sales     ?? 0
    const uberSales     = sales?.uber_sales      ?? 0
    const rocketnowSales = sales?.rocketnow_sales ?? 0
    const menuSales     = sales?.menu_sales      ?? 0
    const deliverySales = (uberSales + rocketnowSales + menuSales) || (sales?.delivery_sales ?? 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthTotal = monthSales.reduce((s: number, r: any) => s + (r.total_sales ?? 0), 0)
    const laborRatio = todaySales > 0 ? Math.round((laborCost / todaySales) * 100) : null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffNames = attendance.map((a: any) => a.staff?.name).filter(Boolean).join('・') || '未打刻'

    // 前週比・先月比
    const vsWeek  = weekAgoSales  ? pctChange(todaySales, weekAgoSales.total_sales ?? 0)  : null
    const vsMonth = monthAgoSales ? pctChange(todaySales, monthAgoSales.total_sales ?? 0) : null

    // デリバリー媒体内訳テキスト
    const deliveryLines = [
      uberSales     > 0 ? `Uber Eats ¥${uberSales.toLocaleString()}` : '',
      rocketnowSales > 0 ? `ロケットなう ¥${rocketnowSales.toLocaleString()}` : '',
      menuSales     > 0 ? `menu ¥${menuSales.toLocaleString()}` : '',
    ].filter(Boolean).join(' / ') || `デリバリー計 ¥${deliverySales.toLocaleString()}`

    let aiComment: string

    if (ANTHROPIC_KEY && sales) {
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY })

      const trendText = [
        vsWeek  ? `先週同曜日比: ${vsWeek}（先週: ¥${(weekAgoSales?.total_sales ?? 0).toLocaleString()}）`  : '先週データなし',
        vsMonth ? `先月同週比: ${vsMonth}（先月: ¥${(monthAgoSales?.total_sales ?? 0).toLocaleString()}）` : '先月データなし',
      ].join('\n')

      const res = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `あなたは飲食店（まぜそば専門店）のベテラン店長です。以下の前日データを見て、店長が朝一番に確認する「日報コメント」を3〜5文で生成してください。

【昨日の実績】
日付: ${target}
売上: 店内¥${(sales.store_sales ?? 0).toLocaleString()} + ${deliveryLines} = 合計¥${todaySales.toLocaleString()}
注文数: 店内${sales.store_orders ?? 0}件 + デリバリー${sales.delivery_orders ?? 0}件
出勤: ${staffNames} (${attendance.length}名)
人件費: ¥${laborCost.toLocaleString()} (L比率: ${laborRatio ?? '-'}%)
月累計売上: ¥${monthTotal.toLocaleString()}

【トレンド比較】
${trendText}

要件:
- 先週比・先月比のトレンドに必ず触れる（良ければ称賛、悪ければ要因を1つ推測）
- 目標: L比率25%以下、FL合計55%以下
- 気になる数字があれば1つだけ具体的に指摘
- 今日の前向きな一言で締める
- 絵文字は2〜3個程度`,
        }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiComment = (res.content[0] as any).text
    } else {
      const trendLine = vsWeek ? ` 先週比${vsWeek}` : ''
      aiComment = sales
        ? `📊 ${target} 日報\n昨日の売上は¥${todaySales.toLocaleString()}（${trendLine}）。L比率${laborRatio ?? '-'}%。今日もよろしくお願いします！`
        : `📊 ${target} の売上データが未登録です。AnyDeliから取り込みをお願いします。`
    }

    // daily_sales 更新
    if (sales) {
      await db.from('daily_sales').update({
        labor_cost: laborCost,
        ai_comment: aiComment,
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', TENANT_ID).eq('date', target)
    }

    // 店長にLINE送信
    const { data: managers } = await db.from('staff')
      .select('line_user_id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    const recipients = managers ?? []
    for (const m of recipients) {
      try {
        // トレンドサマリーを先頭に付ける
        const trendSummary = [
          vsWeek  && `先週比 ${vsWeek}`,
          vsMonth && `先月比 ${vsMonth}`,
        ].filter(Boolean).join(' / ')

        const header = trendSummary
          ? `☀️ おはようございます、${m.name}さん\n📈 ${trendSummary}\n\n`
          : `☀️ おはようございます、${m.name}さん\n\n`

        await sendLineMessage(m.line_user_id, header + aiComment)
      } catch (e) {
        console.error(`Failed to send to ${m.name}:`, e)
      }
    }

    return NextResponse.json({
      ok: true,
      date: target,
      sent: recipients.length,
      vsWeek,
      vsMonth,
      comment: aiComment,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
