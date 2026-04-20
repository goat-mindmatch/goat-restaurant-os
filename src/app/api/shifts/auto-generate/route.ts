export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const TENANT_ID = process.env.TENANT_ID!
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { year, month } = body as { year: number; month: number }

    if (!year || !month) {
      return NextResponse.json({ error: 'year と month が必要です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // 1. アクティブスタッフ取得
    const { data: staffData } = await db
      .from('staff')
      .select('id, name, max_days_per_week')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('name')

    const staff: { id: string; name: string; max_days_per_week: number | null }[] = staffData ?? []

    // 2. シフト希望取得
    const { data: requestData } = await db
      .from('shift_requests')
      .select('staff_id, available_dates')
      .eq('tenant_id', TENANT_ID)
      .eq('target_year', year)
      .eq('target_month', month)

    const requests: { staff_id: string; available_dates: string[] }[] = requestData ?? []

    // 3. 過去8週の曜日別平均売上
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
    const { data: salesData } = await db
      .from('daily_sales')
      .select('date, total_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', eightWeeksAgo.toISOString().split('T')[0])
      .order('date')

    const salesByDow: Record<number, number[]> = {}
    for (const row of (salesData ?? [])) {
      const dow = new Date(row.date + 'T00:00:00').getDay()
      if (!salesByDow[dow]) salesByDow[dow] = []
      salesByDow[dow].push(row.total_sales ?? 0)
    }
    const avgByDow = [0, 1, 2, 3, 4, 5, 6].map(d => {
      const arr = salesByDow[d] ?? []
      return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
    })

    const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
    const busynessMap = avgByDow.map((avg, i) => {
      const level = avg > 80000 ? '高' : avg > 40000 ? '中' : '低'
      return `${DOW_LABELS[i]}:${level}`
    })

    // スタッフ情報テキスト
    const staffText = staff
      .map(s => `${s.name}（週最大${s.max_days_per_week ?? 5}日）`)
      .join(', ')

    // 希望日テキスト
    const staffById = Object.fromEntries(staff.map(s => [s.id, s.name]))
    const requestText = requests
      .map(r => {
        const name = staffById[r.staff_id] ?? r.staff_id
        return `${name}: ${r.available_dates.join(', ')}`
      })
      .join('\n')

    // 4. Claude Haiku でシフト生成
    const prompt = `あなたは飲食店のシフト管理AIです。
以下の条件でシフトを自動作成してください。

スタッフ: ${staffText}
希望日:
${requestText || '（希望提出なし）'}
曜日別混雑予測: ${busynessMap.join(', ')}

制約:
- 週5日以上同じスタッフを入れない
- 希望日は可能な限り優先
- 混雑日（金土日）は最低3人確保
- 閑散日（月火）は最低2人

${year}年${month}月の全日程のシフト案をJSON形式で返してください。
形式: { "YYYY-MM-DD": ["staff_id1", "staff_id2", ...], ... }

スタッフIDと名前の対応:
${staff.map(s => `${s.id}: ${s.name}`).join('\n')}

JSONのみを返してください。説明文は不要です。`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // JSON抽出（コードブロックがあれば除去）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AIがJSONを返しませんでした', raw: rawText }, { status: 500 })
    }

    const shifts: Record<string, string[]> = JSON.parse(jsonMatch[0])

    // スタッフ別合計日数を計算
    const staffTotals: Record<string, number> = {}
    for (const staffIds of Object.values(shifts)) {
      for (const id of staffIds) {
        staffTotals[id] = (staffTotals[id] ?? 0) + 1
      }
    }

    return NextResponse.json({
      ok: true,
      shifts,
      staff,
      staffTotals,
    })
  } catch (err) {
    console.error('auto-generate error:', err)
    return NextResponse.json({ error: 'シフト生成に失敗しました' }, { status: 500 })
  }
}
