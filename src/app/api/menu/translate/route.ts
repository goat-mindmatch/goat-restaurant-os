export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const TENANT_ID = process.env.TENANT_ID!
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { menuItemId, name_ja, description_ja } = body as {
      menuItemId: string
      name_ja: string
      description_ja?: string
    }

    if (!menuItemId || !name_ja) {
      return NextResponse.json({ error: 'menuItemId と name_ja が必要です' }, { status: 400 })
    }

    // Claude Haiku で翻訳
    const prompt = `以下の日本語メニュー名と説明を英語と中国語に翻訳してください。
飲食店メニューとして自然な表現で。

メニュー名: ${name_ja}
説明: ${description_ja ?? '（説明なし）'}

JSON形式のみで返してください（説明文不要）:
{"name_en": "...", "description_en": "...", "name_zh": "...", "description_zh": "..."}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AIがJSONを返しませんでした', raw: rawText }, { status: 500 })
    }

    const translations: {
      name_en: string
      description_en: string
      name_zh: string
      description_zh: string
    } = JSON.parse(jsonMatch[0])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const { error } = await db
      .from('menu_items')
      .update({
        name_en: translations.name_en,
        description_en: translations.description_en,
        name_zh: translations.name_zh,
        description_zh: translations.description_zh,
      })
      .eq('id', menuItemId)
      .eq('tenant_id', TENANT_ID)

    if (error) {
      // カラムが存在しない場合でも翻訳結果は返す
      console.warn('menu_items UPDATE warning:', error)
    }

    return NextResponse.json({
      ok: true,
      translations,
    })
  } catch (err) {
    console.error('menu/translate error:', err)
    return NextResponse.json({ error: '翻訳に失敗しました' }, { status: 500 })
  }
}
