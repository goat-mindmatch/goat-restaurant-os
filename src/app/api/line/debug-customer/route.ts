export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/line/debug-customer
 * お客様用LINEチャネルの診断:
 * - トークンが正しいか（Bot情報取得）
 * - シークレットが設定されているか
 * - Webhookの疎通確認
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const token  = process.env.LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN ?? ''
  const secret = process.env.LINE_CUSTOMER_CHANNEL_SECRET ?? ''

  const results: Record<string, unknown> = {
    env_token_set:  token  !== '',
    env_secret_set: secret !== '',
    token_preview:  token  ? `${token.slice(0, 8)}...` : '未設定',
    secret_preview: secret ? `${secret.slice(0, 6)}...` : '未設定',
  }

  // トークンでBot情報を取得（正しいトークンか確認）
  if (token) {
    try {
      const r = await fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      results.bot_info_status = r.status
      results.bot_info = data
      results.token_valid = r.status === 200
    } catch (e) {
      results.bot_info_error = String(e)
      results.token_valid = false
    }
  } else {
    results.token_valid = false
  }

  // Webhook設定の確認
  if (token) {
    try {
      const r = await fetch('https://api.line.me/v2/bot/channel/webhook/endpoint', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      results.webhook_status = r.status
      results.webhook_info = data
    } catch (e) {
      results.webhook_error = String(e)
    }
  }

  // 診断サマリー
  results._summary = []
  const summary = results._summary as string[]

  if (!results.env_token_set)  summary.push('❌ LINE_CUSTOMER_CHANNEL_ACCESS_TOKEN が未設定')
  if (!results.env_secret_set) summary.push('❌ LINE_CUSTOMER_CHANNEL_SECRET が未設定')
  if (results.env_token_set && !results.token_valid) summary.push('❌ トークンが無効（スタッフ用のトークンが混入している可能性）')
  if (results.token_valid) summary.push('✅ トークン正常')

  // Webhook有効確認
  const webhookInfo = results.webhook_info as Record<string, unknown> | undefined
  if (webhookInfo) {
    if (!webhookInfo.endpoint) summary.push('❌ WebhookのURLが未設定')
    else summary.push(`✅ Webhook URL: ${webhookInfo.endpoint}`)
    if (webhookInfo.active === false) summary.push('❌ Webhookが無効（LINE側でONにする必要あり）')
    if (webhookInfo.active === true) summary.push('✅ Webhook 有効')
  }

  return NextResponse.json(results, { status: 200 })
}
