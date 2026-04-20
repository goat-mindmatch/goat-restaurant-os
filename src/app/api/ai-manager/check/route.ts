/**
 * GET /api/ai-manager/check?secret={CRON_SECRET}
 * AI店長モード — 1時間おきのcronで実行
 * 各種アラートを検知してLINE通知 + ai_manager_logsにINSERT
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendLineMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID ?? 'mazesoba-jinrui'

type Alert = {
  type: 'sales_drop' | 'labor_cost' | 'table_call' | 'review_surge'
  level: 'warning' | 'info'
  message: string
  suggestion: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const firstDayOfMonth = today.slice(0, 7) + '-01'

  // 先週の同曜日
  const lastWeekSameDay = new Date(now)
  lastWeekSameDay.setDate(now.getDate() - 7)
  const lastWeekDate = lastWeekSameDay.toISOString().split('T')[0]

  // 並列でデータ取得
  const [todaySalesRes, lastWeekSalesRes, monthLaborRes, monthSalesRes, tableCallsRes, todayReviewsRes, managersRes] = await Promise.all([
    // 今日の売上
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', today)
      .single(),
    // 先週同曜日の売上
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', lastWeekDate)
      .single(),
    // 今月の人件費
    db.from('daily_sales')
      .select('labor_cost')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDayOfMonth)
      .lte('date', today),
    // 今月の売上
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDayOfMonth)
      .lte('date', today),
    // 未対応テーブル呼び出し（10分以上前）
    db.from('table_calls')
      .select('id, table_number, called_at, status')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'pending')
      .lte('called_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString()),
    // 今日の口コミ件数
    db.from('review_submissions')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59'),
    // manager スタッフ
    db.from('staff')
      .select('id, name, line_user_id')
      .eq('tenant_id', TENANT_ID)
      .eq('role', 'manager')
      .eq('is_active', true),
  ])

  const alerts: Alert[] = []

  // 1. 売上アラート: 今日が先週同曜日比50%以下
  const todaySales: number = todaySalesRes.data?.total_sales ?? 0
  const lastWeekSales: number = lastWeekSalesRes.data?.total_sales ?? 0
  if (lastWeekSales > 0 && todaySales < lastWeekSales * 0.5) {
    alerts.push({
      type: 'sales_drop',
      level: 'warning',
      message: `本日売上 ¥${todaySales.toLocaleString()} — 先週同曜日比 ${Math.round((todaySales / lastWeekSales) * 100)}%`,
      suggestion: 'SNSで今日のおすすめメニューを投稿しましょう',
    })
  }

  // 2. 人件費アラート: 今月人件費率40%超
  const monthLaborTotal: number = (monthLaborRes.data ?? []).reduce((s: number, r: { labor_cost: number | null }) => s + (r.labor_cost ?? 0), 0)
  const monthSalesTotal: number = (monthSalesRes.data ?? []).reduce((s: number, r: { total_sales: number }) => s + (r.total_sales ?? 0), 0)
  const laborRate = monthSalesTotal > 0 ? monthLaborTotal / monthSalesTotal : 0
  if (laborRate > 0.4) {
    alerts.push({
      type: 'labor_cost',
      level: 'warning',
      message: `今月の人件費率 ${(laborRate * 100).toFixed(1)}%（基準40%超）`,
      suggestion: 'シフトを見直し、ピーク時間以外の人員を削減しましょう',
    })
  }

  // 3. 呼び出し放置アラート: 10分以上未対応
  const pendingCalls = tableCallsRes.data ?? []
  if (pendingCalls.length > 0) {
    alerts.push({
      type: 'table_call',
      level: 'warning',
      message: `テーブル呼び出し ${pendingCalls.length}件が10分以上未対応（テーブル: ${pendingCalls.map((c: { table_number: number | string }) => c.table_number).join(', ')}）`,
      suggestion: '今すぐホールスタッフに対応を指示してください',
    })
  }

  // 4. 口コミ急増: 今日5件以上
  const todayReviewCount: number = (todayReviewsRes.data ?? []).length
  if (todayReviewCount >= 5) {
    alerts.push({
      type: 'review_surge',
      level: 'info',
      message: `本日の口コミ件数: ${todayReviewCount}件（急増中）`,
      suggestion: 'お客様の反応を確認し、Googleビジネスプロフィールをチェックしましょう',
    })
  }

  // ai_manager_logs にINSERT
  const logsToInsert = alerts.map(a => ({
    tenant_id: TENANT_ID,
    alert_type: a.type,
    level: a.level,
    message: a.message,
    suggestion: a.suggestion,
    triggered_at: now.toISOString(),
  }))

  if (logsToInsert.length > 0) {
    await db.from('ai_manager_logs').insert(logsToInsert)
  }

  // manager LINE通知
  const managers = (managersRes.data ?? []).filter(
    (m: { line_user_id: string | null }) => m.line_user_id
  )
  const lineErrors: string[] = []

  if (alerts.length > 0 && managers.length > 0) {
    const notifyText = [
      `🤖 AI店長チェック（${now.getHours()}時）`,
      '',
      ...alerts.map(a => `${a.level === 'warning' ? '⚠️' : 'ℹ️'} ${a.message}\n💡 ${a.suggestion}`),
    ].join('\n')

    for (const manager of managers) {
      try {
        await sendLineMessage(manager.line_user_id as string, notifyText)
      } catch (e) {
        lineErrors.push(`${manager.name}: ${e instanceof Error ? e.message : 'error'}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checkedAt: now.toISOString(),
    alerts,
    todaySales,
    lastWeekSales,
    laborRate: `${(laborRate * 100).toFixed(1)}%`,
    pendingCallCount: pendingCalls.length,
    todayReviewCount,
    lineErrors,
  })
}
