/**
 * POST /api/sns/generate-caption
 * AIキャプション・ハッシュタグ生成
 * モデル: claude-haiku-4-5-20251001
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { menu_name?: string; description?: string; price?: number }
    const { menu_name, description, price } = body

    if (!menu_name) {
      return NextResponse.json({ error: 'menu_nameは必須です' }, { status: 400 })
    }

    const prompt = `あなたは飲食店のSNSマーケターです。以下のメニューに対して、Instagram・TikTok向けの魅力的な日本語キャプションとハッシュタグを生成してください。

メニュー名: ${menu_name}
${description ? `説明: ${description}` : ''}
${price ? `価格: ¥${price.toLocaleString()}` : ''}

以下のJSON形式で回答してください（コードブロック不要）:
{
  "caption": "（100字以内の魅力的なキャプション。絵文字を活用し、食欲をそそる表現で）",
  "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3", "ハッシュタグ4", "ハッシュタグ5"]
}`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AIレスポンスの解析に失敗しました')

    const result = JSON.parse(match[0]) as { caption: string; hashtags: string[] }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[sns/generate-caption]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'キャプション生成に失敗しました' },
      { status: 500 }
    )
  }
}
