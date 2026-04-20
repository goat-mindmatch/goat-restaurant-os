/**
 * POST /api/menu/ai-analyze
 * メニューエンジニアリング AI分析
 * モデル: claude-haiku-4-5-20251001（コスト最適化）
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { MenuEngineeringItem } from '@/app/dashboard/menu-engineering/page'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { items: MenuEngineeringItem[] }
    const { items } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'メニューデータがありません' }, { status: 400 })
    }

    const stars      = items.filter(i => i.quadrant === 'star')
    const plowhorses = items.filter(i => i.quadrant === 'plowhorse')
    const puzzles    = items.filter(i => i.quadrant === 'puzzle')
    const dogs       = items.filter(i => i.quadrant === 'dog')

    const prompt = `あなたは飲食店のメニューコンサルタントです。以下のメニューエンジニアリング分析結果をもとに、オーナーへの改善提案を日本語200字程度で簡潔にまとめてください。

【スター（高注文・高利益）${stars.length}品】${stars.map(i => `${i.name}(¥${i.price},利益率${(i.profit_rate*100).toFixed(0)}%,${i.order_count}件)`).join('、')}
【プラウホース（高注文・低利益）${plowhorses.length}品】${plowhorses.map(i => `${i.name}(¥${i.price},利益率${(i.profit_rate*100).toFixed(0)}%,${i.order_count}件)`).join('、')}
【パズル（低注文・高利益）${puzzles.length}品】${puzzles.map(i => `${i.name}(¥${i.price},利益率${(i.profit_rate*100).toFixed(0)}%,${i.order_count}件)`).join('、')}
【ドッグ（低注文・低利益）${dogs.length}品】${dogs.map(i => `${i.name}(¥${i.price},利益率${(i.profit_rate*100).toFixed(0)}%,${i.order_count}件)`).join('、')}

上記を踏まえて、最優先で取り組むべき改善アクションを具体的に提案してください。`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const comment = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return NextResponse.json({ comment })
  } catch (err) {
    console.error('[menu/ai-analyze]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI分析に失敗しました' },
      { status: 500 }
    )
  }
}
