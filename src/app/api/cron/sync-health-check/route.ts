export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/sync-health-check
 * Vercel Cronで毎日呼ばれる売上同期ヘルスチェック。
 *
 * 監視ルール:
 *   - AnyDeli: anydeli_synced_at が 36時間以上前 → 同期停止アラート
 *   - Uber:    uber_synced_at が 36時間以上前 → 同期停止アラート
 *   - RocketNow: rocketnow_synced_at が 36時間以上前 → 同期停止アラート
 *   - いずれかが3日連続で total_sales=0 だが同期は走っている → セッション切れ疑い
 *
 * 異常時は経営者ロールのLINEへPush通知する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET

const STALE_HOURS = 36

type SalesRow = {
  date: string
  total_sales: number | null
  anydeli_sales: number | null
  uber_sales: number | null
  rocketnow_sales: number | null
  anydeli_synced_at: string | null
  uber_synced_at: string | null
  rocketnow_synced_at: string | null
}

function hoursSince(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 直近5日の同期メタを取得
  const { data: rows } = await db
    .from('daily_sales')
    .select('date, total_sales, anydeli_sales, uber_sales, rocketnow_sales, anydeli_synced_at, uber_synced_at, rocketnow_synced_at')
    .eq('tenant_id', TENANT_ID)
    .order('date', { ascending: false })
    .limit(5)

  const list = (rows ?? []) as SalesRow[]
  if (list.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no daily_sales rows found' }, { status: 200 })
  }

  const issues: string[] = []
  const services: Array<{ key: keyof SalesRow; salesKey: keyof SalesRow; label: string }> = [
    { key: 'anydeli_synced_at',   salesKey: 'anydeli_sales',   label: 'AnyDeli' },
    { key: 'uber_synced_at',      salesKey: 'uber_sales',      label: 'Uber Eats' },
    { key: 'rocketnow_synced_at', salesKey: 'rocketnow_sales', label: 'RocketNow' },
  ]

  for (const svc of services) {
    const latest = list[0]
    const lastSync = latest[svc.key] as string | null
    const stale = hoursSince(lastSync)

    // 同期が完全に止まっている
    if (stale > STALE_HOURS) {
      issues.push(
        `❌ ${svc.label}: 最終同期から ${Math.round(stale)} 時間経過 ` +
        `(最終: ${lastSync ?? '記録なし'})`
      )
      continue
    }

    // 同期は走っているが3日連続で売上0 → セッション切れの可能性
    const recent3 = list.slice(0, 3)
    const allZero = recent3.every((r) => (Number(r[svc.salesKey] ?? 0) === 0))
    const anySync = recent3.some((r) => r[svc.key] != null)
    if (allZero && anySync) {
      issues.push(
        `⚠️ ${svc.label}: 直近3日連続で売上 ¥0 ` +
        `（同期は実行されているがセッション切れ・データ取得失敗の可能性）`
      )
    }
  }

  if (issues.length === 0) {
    return NextResponse.json({ ok: true, message: '全サービス正常', checked: list.length })
  }

  // 経営者ロールへ通知
  const { data: managers } = await db
    .from('staff')
    .select('line_user_id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('role', 'manager')
    .eq('is_active', true)
    .not('line_user_id', 'is', null)

  const message =
    `🚨 売上同期ヘルスチェック異常\n\n` +
    issues.join('\n\n') +
    `\n\n対応手順:\n` +
    `1. GitHub Actionsの実行履歴を確認\n` +
    `2. セッション切れの場合は Mac で\n` +
    `   node scripts/setup-delivery-session.js <service>\n` +
    `   を実行してSecretsを更新`

  const notified: string[] = []
  for (const m of (managers ?? []) as Array<{ line_user_id: string; name: string }>) {
    try {
      await sendLineMessage(m.line_user_id, message)
      notified.push(m.name)
    } catch (e) {
      console.error('[sync-health-check] push failed:', m.name, e)
    }
  }

  return NextResponse.json({
    ok: false,
    issues,
    notified,
    checked_dates: list.map((r) => r.date),
  })
}
