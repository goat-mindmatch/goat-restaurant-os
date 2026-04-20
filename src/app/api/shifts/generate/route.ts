export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/shifts/generate
 * スタッフの希望提出状況をもとにAIがシフト表の叩き台を生成
 * body: { year, month } ← 省略時は来月
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { year?: number; month?: number; notify?: boolean }

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const year  = body.year  ?? nextMonth.getFullYear()
    const month = body.month ?? nextMonth.getMonth() + 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 希望提出データ取得
    const { data: requests } = await db.from('shift_requests')
      .select('staff_id, available_dates, staff:staff!reviews_staff_id_fkey(name, hourly_wage)')
      .eq('tenant_id', TENANT_ID)
      .eq('target_year', year)
      .eq('target_month', month)

    if (!requests?.length) {
      return NextResponse.json({ error: `${year}年${month}月のシフト希望が届いていません` }, { status: 400 })
    }

    // スタッフ情報をまとめる
    const staffSummary = requests.map((r: {
      staff_id: string
      available_dates: string[]
      staff: { name: string; hourly_wage?: number } | null
    }) => ({
      name: r.staff?.name ?? '不明',
      wage: r.staff?.hourly_wage ?? 1100,
      availableDates: (r.available_dates ?? []).map((d: string) => parseInt(d.split('-')[2])).sort((a: number, b: number) => a - b),
    }))

    const daysInMonth = new Date(year, month, 0).getDate()
    const DAYS_JP = ['日','月','火','水','木','金','土']

    // 日付リスト（曜日付き）
    const dateList = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const dow = new Date(year, month - 1, d).getDay()
      return `${d}日(${DAYS_JP[dow]})`
    }).join(', ')

    // スタッフ希望サマリー
    const staffSummaryText = staffSummary.map((s: { name: string; wage: number; availableDates: number[] }) =>
      `${s.name}（時給¥${s.wage}）: ${s.availableDates.join(',')}日`
    ).join('\n')

    // Claude APIでシフト生成
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const prompt = `あなたは飲食店のシフト管理者です。
以下の条件でシフト表の叩き台を作成してください。

【期間】${year}年${month}月（全${daysInMonth}日）
【曜日】${dateList}

【スタッフ希望出勤日】
${staffSummaryText}

【ルール】
- 1日あたり最低2名・最大4名
- 週休2日を確保（希望日が多くても削る）
- 土日は多めにシフトを入れる
- 人件費を抑えつつ必要人数を確保

【出力形式】
各日付ごとに出勤スタッフ名をリスト形式で出力してください。
以下の形式で出力:
1日: 田中、山田
2日: 鈴木
...（人がいない日はスキップ）

最後に「合計シフト数: X人/月」を追記してください。`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const shiftDraft = response.content[0].type === 'text' ? response.content[0].text : ''

    // 経営者にLINEで送信（オプション）
    if (body.notify !== false) {
      const { data: managers } = await db.from('staff')
        .select('line_user_id')
        .eq('tenant_id', TENANT_ID)
        .eq('role', 'manager')
        .eq('is_active', true)
        .not('line_user_id', 'is', null)

      for (const m of managers ?? []) {
        await sendLineMessage(m.line_user_id,
          `📅 ${year}年${month}月 シフト叩き台（AI生成）\n\n` +
          shiftDraft +
          `\n\n⚠️ これはAIの叩き台です。\nダッシュボードで確認・修正してください👇\nhttps://goat-restaurant-os.vercel.app/dashboard/shifts`
        ).catch(() => {})
      }
    }

    return NextResponse.json({
      ok: true,
      year,
      month,
      staff_count: staffSummary.length,
      shift_draft: shiftDraft,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
