export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reports/daily
 * 指定日の売上・シフト・打刻データから AI日報を生成
 * body: { date? }  (省略時は今日)
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { date } = await req.json().catch(() => ({}))
    const target = date || new Date().toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // データ収集
    const [salesRes, attendanceRes, monthSalesRes] = await Promise.all([
      db.from('daily_sales').select('*').eq('tenant_id', TENANT_ID).eq('date', target).single(),
      db.from('attendance').select('clock_in, clock_out, work_minutes, staff(name, hourly_wage)')
        .eq('tenant_id', TENANT_ID).eq('date', target),
      db.from('daily_sales').select('total_sales, store_sales, delivery_sales')
        .eq('tenant_id', TENANT_ID)
        .gte('date', target.slice(0, 7) + '-01')
        .lte('date', target),
    ])

    const sales = salesRes.data ?? null
    const attendance = attendanceRes.data ?? []
    const monthSales = monthSalesRes.data ?? []

    // 人件費計算
    const laborCost = attendance.reduce((sum: number, a: { work_minutes: number | null; staff: { hourly_wage: number } | null }) => {
      if (!a.work_minutes || !a.staff?.hourly_wage) return sum
      return sum + Math.round((a.work_minutes / 60) * a.staff.hourly_wage)
    }, 0)

    const todaySales = sales?.total_sales ?? 0
    const monthTotal = monthSales.reduce((s: number, r: { total_sales: number }) => s + (r.total_sales ?? 0), 0)
    const laborRatio = todaySales > 0 ? Math.round((laborCost / todaySales) * 100) : null

    // プロンプト構築
    const staffNames = attendance
      .map((a: { staff: { name: string } | null }) => a.staff?.name)
      .filter(Boolean).join('・') || '未打刻'

    const dataContext = `
日付: ${target}
売上: 店内¥${(sales?.store_sales ?? 0).toLocaleString()} + デリバリー¥${(sales?.delivery_sales ?? 0).toLocaleString()} = 合計¥${todaySales.toLocaleString()}
注文数: 店内${sales?.store_orders ?? 0}件 + デリバリー${sales?.delivery_orders ?? 0}件
出勤: ${staffNames} (${attendance.length}名)
人件費: ¥${laborCost.toLocaleString()} (L比率: ${laborRatio ?? '-'}%)
月累計売上: ¥${monthTotal.toLocaleString()}
`.trim()

    let aiComment: string

    if (ANTHROPIC_KEY) {
      // Claude API で日報生成
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
      const res = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `あなたは飲食店（まぜそば専門店）のベテラン店長です。以下の当日データを見て、店長が朝一番に確認する「日報コメント」を3〜4文で生成してください。\n\n${dataContext}\n\n要件:\n- 数字の良し悪しに触れる（目標: L比率25%以下、FL合計55%以下）\n- 気になる傾向や改善点があれば1つだけ指摘\n- 明日への前向きな一言で締める\n- ビジネス的で簡潔に。絵文字は1〜2個程度`,
        }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiComment = (res.content[0] as any).text
    } else {
      // フォールバック: テンプレート日報
      const laborAssessment = laborRatio === null ? '出勤データなし'
        : laborRatio <= 25 ? 'L比率は目標内で健全です'
        : laborRatio <= 30 ? 'L比率やや高め。注意が必要です'
        : 'L比率が目標を超過。人員配置の見直しを'

      aiComment = `📊 ${target} 日報\n本日の売上は¥${todaySales.toLocaleString()}（注文${(sales?.store_orders ?? 0) + (sales?.delivery_orders ?? 0)}件）。${laborAssessment}。明日もよろしくお願いします。`
    }

    // daily_sales に保存
    await db.from('daily_sales').update({
      labor_cost: laborCost,
      ai_comment: aiComment,
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', TENANT_ID).eq('date', target)

    return NextResponse.json({
      ok: true,
      date: target,
      comment: aiComment,
      metrics: { sales: todaySales, laborCost, laborRatio },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
