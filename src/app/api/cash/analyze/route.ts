export const dynamic = 'force-dynamic'

/**
 * POST /api/cash/analyze
 * 現金の写真を受け取り、Claude Vision APIで紙幣・硬貨を数えて合計金額を返す
 *
 * body: FormData { image: File, date?: string }
 * response: {
 *   ok: true,
 *   bills:  { 10000: N, 5000: N, 2000: N, 1000: N },
 *   coins:  { 500: N, 100: N, 50: N, 10: N, 5: N, 1: N },
 *   total:  number,
 *   confidence: 'high' | 'medium' | 'low',
 *   note:   string | null
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 最大ファイルサイズ: 8MB
const MAX_SIZE = 8 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: '画像ファイルが必要です' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '画像サイズは8MB以内にしてください' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: 'JPEG/PNG/WebP/HEICのみ対応しています' }, { status: 400 })
    }

    // ArrayBuffer → base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // HEIC は jpeg として送信（Claude が処理できる形式に変換）
    const mediaType = (file.type.toLowerCase().includes('heic') || file.type.toLowerCase().includes('heif'))
      ? 'image/jpeg'
      : file.type as 'image/jpeg' | 'image/png' | 'image/webp'

    const prompt = `あなたは日本円の現金を正確に数える専門家です。
写真に写っている日本円の紙幣・硬貨の枚数を面額ごとに数えてください。

【数え方の指示】
- 紙幣・硬貨は面額別にまとめて並べられていることが多いです
- 重なっている場合は見えている枚数を最大限数えてください
- 見えない・不明な部分は 0 としてください

【対象面額】
紙幣: 10,000円 / 5,000円 / 2,000円 / 1,000円
硬貨: 500円 / 100円 / 50円 / 10円 / 5円 / 1円

必ず以下のJSON形式のみで回答してください（説明文・前置き不要）:
{
  "bills": {
    "10000": 枚数,
    "5000": 枚数,
    "2000": 枚数,
    "1000": 枚数
  },
  "coins": {
    "500": 枚数,
    "100": 枚数,
    "50": 枚数,
    "10": 枚数,
    "5": 枚数,
    "1": 枚数
  },
  "total": 合計金額（整数）,
  "confidence": "high または medium または low",
  "note": "気になる点や不明瞭な部分があれば記載（なければ null）"
}`

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001', // コスト最適化（Haiku固定）
      max_tokens: 512,
      messages: [
        {
          role:    'user',
          content: [
            {
              type:   'image',
              source: {
                type:       'base64',
                media_type: mediaType,
                data:       base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // JSONを抽出（```json ... ``` に包まれている場合も対応）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Claude Vision: JSONを抽出できませんでした', rawText)
      return NextResponse.json({
        error: 'AIが現金を認識できませんでした。写真を明るく撮り直してください。',
        raw:   rawText.slice(0, 200),
      }, { status: 422 })
    }

    const result = JSON.parse(jsonMatch[0]) as {
      bills:      Record<string, number>
      coins:      Record<string, number>
      total:      number
      confidence: string
      note:       string | null
    }

    // 合計金額を再計算（AIの計算を検証）
    const calcTotal =
      (Number(result.bills?.['10000'] || 0) * 10000) +
      (Number(result.bills?.['5000']  || 0) *  5000) +
      (Number(result.bills?.['2000']  || 0) *  2000) +
      (Number(result.bills?.['1000']  || 0) *  1000) +
      (Number(result.coins?.['500']   || 0) *   500) +
      (Number(result.coins?.['100']   || 0) *   100) +
      (Number(result.coins?.['50']    || 0) *    50) +
      (Number(result.coins?.['10']    || 0) *    10) +
      (Number(result.coins?.['5']     || 0) *     5) +
      (Number(result.coins?.['1']     || 0) *     1)

    return NextResponse.json({
      ok:         true,
      bills:      result.bills      || {},
      coins:      result.coins      || {},
      total:      calcTotal,                     // 計算値を採用（AIの計算より正確）
      ai_total:   result.total,                  // AIが返した合計（参考）
      confidence: result.confidence || 'medium',
      note:       result.note       || null,
    })

  } catch (e) {
    console.error('cash/analyze error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
