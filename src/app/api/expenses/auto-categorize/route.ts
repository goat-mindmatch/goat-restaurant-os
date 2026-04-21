export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/expenses/auto-categorize
 * category='other' の経費をAIで一括再仕分け
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

const CATEGORY_HINT = `
カテゴリ一覧:
- food      : 食材費・食品・飲料・仕入れ・業務用スーパー
- utility   : 光熱費・電気・ガス・水道
- consumable: 消耗品・洗剤・ラップ・袋・文具・紙・梱包資材
- equipment : 設備費・修理・機器・リース・什器
- rent      : 家賃・賃料・共益費
- communication: 通信費・インターネット・電話・サブスク
- other     : 上記以外
`

export async function POST() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // category='other' の経費を取得（最大50件）
    const { data: others, error } = await db
      .from('expenses')
      .select('id, vendor, note, amount')
      .eq('tenant_id', TENANT_ID)
      .eq('category', 'other')
      .order('date', { ascending: false })
      .limit(50)

    if (error) throw error
    if (!others || others.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, message: '仕分けが必要な経費はありませんでした' })
    }

    if (!ANTHROPIC_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_KEY })

    // バッチで処理（一度に最大10件）
    const results: { id: string; category: string }[] = []

    for (let i = 0; i < others.length; i += 10) {
      const batch = others.slice(i, i + 10)
      const prompt = `以下の経費リストを適切なカテゴリに分類してください。
${CATEGORY_HINT}

経費リスト（JSON配列）:
${JSON.stringify(batch.map((e: { id: string; vendor: string | null; note: string | null; amount: number }) => ({
  id: e.id,
  vendor: e.vendor ?? '',
  note: e.note ?? '',
  amount: e.amount,
})))}

回答はJSON配列のみ。形式: [{"id": "xxx", "category": "food"}, ...]`

      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = res.content[0].type === 'text' ? res.content[0].text : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as { id: string; category: string }[]
          results.push(...parsed)
        } catch { /* ignore parse error */ }
      }
    }

    // DBを更新
    let updated = 0
    const VALID = ['food', 'utility', 'consumable', 'equipment', 'rent', 'communication', 'other']
    for (const r of results) {
      if (!VALID.includes(r.category) || r.category === 'other') continue
      const { error: upErr } = await db
        .from('expenses')
        .update({ category: r.category })
        .eq('id', r.id)
        .eq('tenant_id', TENANT_ID)
      if (!upErr) updated++
    }

    return NextResponse.json({
      ok: true,
      updated,
      total: others.length,
      message: `${others.length}件中 ${updated}件を自動仕分けしました`,
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
