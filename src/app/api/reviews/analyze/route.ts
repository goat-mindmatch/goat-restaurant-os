export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/reviews/analyze
 * 口コミ本文をAIで感情分析し、EXPを決定する
 * body: { review_text: string }
 * response: { sentiment: 'positive'|'neutral'|'negative', reason: string, exp: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const EXP_MAP = {
  positive: 200,
  neutral:  150,
  negative: 120,
} as const

type Sentiment = keyof typeof EXP_MAP

export async function POST(req: NextRequest) {
  try {
    const { review_text } = await req.json()

    if (!review_text || String(review_text).trim().length < 10) {
      return NextResponse.json({ error: '口コミ本文が短すぎます' }, { status: 400 })
    }

    const text = String(review_text).trim().slice(0, 1000)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `以下は飲食店のGoogle口コミ本文です。スタッフ・店員への言及を重点的に読み、下記の基準で感情を判定してください。

【判定基準】
- positive: スタッフ・店員を名指しで褒める、接客を絶賛している、「また来たい」「スタッフが最高」などの言及がある
- negative: スタッフへの批判、接客への不満、「対応が悪い」「待たされた」「態度が悪い」などの言及がある
- neutral: スタッフへの言及なし、または料理・価格のみの評価

必ずJSON形式で返してください：
{"sentiment":"positive"|"neutral"|"negative","reason":"判定理由を日本語で20字以内"}

口コミ本文：
${text}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // JSONを抽出（前後に余分なテキストがついている場合に対応）
    const jsonMatch = raw.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      throw new Error('AI応答のパースに失敗しました')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { sentiment: string; reason: string }
    const sentiment: Sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
      ? (parsed.sentiment as Sentiment)
      : 'neutral'

    return NextResponse.json({
      sentiment,
      reason:  parsed.reason ?? '',
      exp:     EXP_MAP[sentiment],
    })
  } catch (e) {
    console.error('[analyze] error:', e)
    // AI失敗時はneutral/150でフォールバック
    return NextResponse.json({
      sentiment: 'neutral',
      reason:    '分析失敗（デフォルト適用）',
      exp:       150,
    })
  }
}
