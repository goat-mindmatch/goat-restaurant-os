export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/today-sales?date=YYYY-MM-DD
 * 当日売上＋目標判定＋スタッフ飯を一括返却する集約API
 *   - 各プラットフォーム別の売上
 *   - 月次累計
 *   - 月次目標／日次目標／昼夜目標
 *   - 昼/夜判定（×/◯/◎）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

function jstDateString(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function jstHour(): number {
  return Math.floor((Date.now() + 9 * 60 * 60 * 1000) / (60 * 60 * 1000)) % 24
}

type Judgement = '×' | '◯' | '◎' | '—'
function judge(actual: number, target: number): Judgement {
  if (target <= 0) return '—'
  if (actual >= target + 15_000) return '◎'
  if (actual >= target) return '◯'
  return '×'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? jstDateString()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const monthStr = date.slice(0, 7)
  const firstDay = `${monthStr}-01`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  // 当日Google口コミ件数: history の最新2件で delta を出す
  const [todayRes, monthRes, tenantRes, mealsTodayRes, mealsMonthRes, reviewHistoryRes, reviewMonthRes] = await Promise.all([
    db.from('daily_sales')
      .select('date, total_sales, store_sales, delivery_sales, lunch_sales, dinner_sales, anydeli_sales, anydeli_cash_sales, anydeli_online_sales, uber_sales, rocketnow_sales')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date)
      .maybeSingle(),
    db.from('daily_sales')
      .select('total_sales')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', date),
    db.from('tenants')
      .select('monthly_target, lunch_target_ratio')
      .eq('id', TENANT_ID)
      .single(),
    db.from('staff_meals')
      .select('amount')
      .eq('tenant_id', TENANT_ID)
      .eq('date', date),
    db.from('staff_meals')
      .select('amount')
      .eq('tenant_id', TENANT_ID)
      .gte('date', firstDay)
      .lte('date', date),
    db.from('google_review_count_history')
      .select('count, checked_at')
      .eq('tenant_id', TENANT_ID)
      .order('checked_at', { ascending: false })
      .limit(2),
    db.from('reviews')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .gte('verified_at', `${firstDay}T00:00:00`)
      .lte('verified_at', `${date}T23:59:59`)
      .not('verified_at', 'is', null),
  ])

  const today = todayRes.data as null | {
    date: string
    total_sales: number | null
    store_sales: number | null
    delivery_sales: number | null
    lunch_sales: number | null
    dinner_sales: number | null
    anydeli_sales: number | null
    anydeli_cash_sales: number | null
    anydeli_online_sales: number | null
    uber_sales: number | null
    rocketnow_sales: number | null
  }

  const monthRows = (monthRes.data ?? []) as Array<{ total_sales: number | null }>
  const tenant = (tenantRes.data ?? {}) as { monthly_target: number | null; lunch_target_ratio: number | null }
  const mealsToday = (mealsTodayRes.data ?? []) as Array<{ amount: number }>
  const mealsMonth = (mealsMonthRes.data ?? []) as Array<{ amount: number }>
  const reviewHist = (reviewHistoryRes.data ?? []) as Array<{ count: number; checked_at: string }>
  const reviewMonth = (reviewMonthRes.data ?? []) as Array<{ id: string }>

  const reviewTotalCount = reviewHist[0]?.count ?? 0
  const reviewDelta = reviewHist.length >= 2 ? Math.max(0, reviewHist[0].count - reviewHist[1].count) : 0
  const reviewMonthAttributed = reviewMonth.length

  const monthlyTarget = Number(tenant.monthly_target ?? 0)
  const lunchRatio    = Number(tenant.lunch_target_ratio ?? 0.6)
  // 簡易: 月次目標 / 月日数
  const [y, m] = monthStr.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const dailyTarget   = monthlyTarget > 0 ? Math.round(monthlyTarget / daysInMonth) : 0
  const lunchTarget   = Math.round(dailyTarget * lunchRatio)
  const dinnerTarget  = Math.round(dailyTarget * (1 - lunchRatio))

  // 売上集計
  const storeSales   = Number(today?.store_sales    ?? 0)
  const anydeliSales = Number(today?.anydeli_sales  ?? 0)
  const uberSales    = Number(today?.uber_sales     ?? 0)
  const rocketSales  = Number(today?.rocketnow_sales ?? 0)
  const lunchSales   = Number(today?.lunch_sales    ?? 0)
  const dinnerSales  = Number(today?.dinner_sales   ?? 0)
  const totalSales   = Number(today?.total_sales    ?? 0)

  // lunch/dinner_sales が未設定なら anydeli を昼夜に分けられないので 0 扱い
  const monthTotal = monthRows.reduce((s, r) => s + Number(r.total_sales ?? 0), 0)
  const mealsTodayTotal = mealsToday.reduce((s, r) => s + r.amount, 0)
  const mealsMonthTotal = mealsMonth.reduce((s, r) => s + r.amount, 0)

  const hour = jstHour()
  return NextResponse.json({
    date,
    hour_jst: hour,
    show_lunch:  hour >= 15 || date < jstDateString(),
    show_total:  hour >= 21 || date < jstDateString(),
    targets: {
      monthly: monthlyTarget,
      daily:   dailyTarget,
      lunch:   lunchTarget,
      dinner:  dinnerTarget,
      lunch_ratio: lunchRatio,
    },
    sales: {
      total:    totalSales,
      store:    storeSales,
      anydeli:  anydeliSales,
      uber:     uberSales,
      rocketnow: rocketSales,
      lunch:    lunchSales,
      dinner:   dinnerSales,
      anydeli_cash:   Number(today?.anydeli_cash_sales   ?? 0),
      anydeli_online: Number(today?.anydeli_online_sales ?? 0),
    },
    judgements: {
      lunch:  judge(lunchSales,  lunchTarget),
      dinner: judge(dinnerSales, dinnerTarget),
      day:    judge(totalSales,  dailyTarget),
    },
    month: {
      total: monthTotal,
      target: monthlyTarget,
      progress_pct: monthlyTarget > 0 ? Math.round((monthTotal / monthlyTarget) * 100) : 0,
    },
    staff_meals: {
      today: mealsTodayTotal,
      month: mealsMonthTotal,
    },
    google_reviews: {
      total_count: reviewTotalCount,
      delta_today: reviewDelta,
      month_attributed: reviewMonthAttributed,
    },
  })
}
