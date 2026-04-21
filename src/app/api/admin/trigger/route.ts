export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/trigger
 * 管理者ツールからの内部API呼び出しプロキシ
 * CRON_SECRET はサーバー側で付与するため、URLには一切露出しない
 *
 * body: { action: string }
 * actions:
 *   weekly-report   → /api/reports/weekly (GET + secret)
 *   ai-manager-check → /api/ai-manager/check (GET + secret)
 *   daily-report    → /api/line/daily-report (GET + secret)
 *   send-mission    → /api/line/send-mission (POST)
 *   send-payslips   → /api/payroll/send-slip (POST)
 *   auto-order      → /api/inventory/auto-order (GET + secret)
 */

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goat-restaurant-os.vercel.app'
const SECRET   = process.env.CRON_SECRET ?? ''

const ACTION_MAP: Record<string, { path: string; method: 'GET' | 'POST' }> = {
  'weekly-report':    { path: '/api/reports/weekly',        method: 'GET' },
  'ai-manager-check': { path: '/api/ai-manager/check',      method: 'GET' },
  'daily-report':     { path: '/api/line/daily-report',     method: 'GET' },
  'send-mission':     { path: '/api/line/send-mission',     method: 'POST' },
  'send-payslips':    { path: '/api/payroll/send-slip',     method: 'GET' },
  'auto-order':       { path: '/api/inventory/auto-order',  method: 'GET' },
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json() as { action: string }
    const config = ACTION_MAP[action]
    if (!config) {
      return NextResponse.json({ error: `不明なアクション: ${action}` }, { status: 400 })
    }

    // URLを組み立て（GETの場合はsecretをクエリに付与）
    let url = `${BASE_URL}${config.path}`
    if (config.method === 'GET') {
      url += `?secret=${encodeURIComponent(SECRET)}`
    }

    const fetchOpts: RequestInit = {
      method: config.method,
      headers: { 'Content-Type': 'application/json' },
    }
    // POSTの場合もsecretをbodyに含める
    if (config.method === 'POST') {
      fetchOpts.body = JSON.stringify({ secret: SECRET })
    }

    const res = await fetch(url, fetchOpts)
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        message: `⚠️ ${data.error ?? data.message ?? 'エラーが発生しました'}`,
      }, { status: 200 })
    }

    // 成功メッセージを整形
    let message = '✅ 実行完了'
    if (data.sent !== undefined) message = `✅ ${data.sent}件送信完了`
    else if (data.updated !== undefined) message = `✅ ${data.updated}件更新完了`
    else if (data.message) message = `✅ ${data.message}`

    return NextResponse.json({ ok: true, message, raw: data })
  } catch (e) {
    return NextResponse.json({ ok: false, message: `❌ ${(e as Error).message}` }, { status: 200 })
  }
}
