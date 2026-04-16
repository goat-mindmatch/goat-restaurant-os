export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/daily-report
 * Vercel Cronから毎朝8:30 JSTに呼ばれる
 * - 昨日の日報を生成
 * - 店長(role='manager')のLINEに配信
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const CRON_SECRET = process.env.CRON_SECRET

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
    const target = yesterday.toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 昨日の各種データ取得
    const [salesRes, attendanceRes, monthSalesRes] = await Promise.all([
      db.from('daily_sales').select('*').eq('tenant_id', TENANT_ID).eq('date', target).single(),
      db.from('attendance').select('clock_in, clock_out, work_minutes, staff(name, hourly_wage)')
        .eq('tenant_id', TENANT_ID).eq('date', target),
      db.from('daily_sales').select('total_sales').eq('tenant_id', TENANT_ID)
        .gte('date', target.slice(0, 7) + '-01').lte('date', target),
    ])

    const sales = salesRes.data ?? null
    const attendance = attendanceRes.data ?? []
    const monthSales = monthSalesRes.data ?? []

    // 人件費計算
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const laborCost = attendance.reduce((sum: number, a: any) => {
      if (!a.work_minutes || !a.staff?.hourly_wage) return sum
      return sum + Math.round((a.work_minutes / 60) * a.staff.hourly_wage)
    }, 0)

    const todaySales = sales?.total_sales ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monthTotal = monthSales.reduce((s: number, r: any) => s + (r.total_sales ?? 0), 0)
    const laborRatio = todaySales > 0 ? Math.round((laborCost / todaySales) * 100) : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffNames = attendance.map((a: any) => a.staff?.name).filter(Boolean).join('・') || '未打刻'

    let aiComment: string

    if (ANTHROPIC_KEY && sales) {
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY })
      const res = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `あなたは飲食店（まぜそば専門店）のベテラン店長です。以下の前日データを見て、店長が朝一番に確認する「日報コメント」を3〜4文で生成してください。\n\n日付: ${target}\n売上: 店内¥${(sales.store_sales ?? 0).toLocaleString()} + デリバリー¥${(sales.delivery_sales ?? 0).toLocaleString()} = 合計¥${todaySales.toLocaleString()}\n注文数: 店内${sales.store_orders ?? 0}件 + デリバリー${sales.delivery_orders ?? 0}件\n出勤: ${staffNames} (${attendance.length}名)\n人件費: ¥${laborCost.toLocaleString()} (L比率: ${laborRatio ?? '-'}%)\n月累計売上: ¥${monthTotal.toLocaleString()}\n\n要件:\n- 数字の良し悪しに触れる（目標: L比率25%以下、FL合計55%以下）\n- 気になる傾向や改善点があれば1つだけ指摘\n- 今日の前向きな一言で締める\n- 絵文字は1〜2個程度`,
        }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiComment = (res.content[0] as any).text
    } else {
      aiComment = sales
        ? `📊 ${target} 日報\n昨日の売上は¥${todaySales.toLocaleString()}（注文${(sales.store_orders ?? 0) + (sales.delivery_orders ?? 0)}件）。L比率${laborRatio ?? '-'}%。今日もよろしくお願いします！`
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
        await sendLineMessage(m.line_user_id, `☀️ おはようございます、${m.name}さん\n\n${aiComment}`)
      } catch (e) {
        console.error(`Failed to send to ${m.name}:`, e)
      }
    }

    return NextResponse.json({
      ok: true,
      date: target,
      sent: recipients.length,
      comment: aiComment,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
