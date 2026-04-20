export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/pl/export?month=YYYY-MM
 * 指定月のPLデータをExcelファイルで返す
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase'

const TENANT_ID = process.env.TENANT_ID!

const CATEGORY_LABELS: Record<string, string> = {
  food: '食材費',
  utility: '光熱費',
  consumable: '消耗品',
  equipment: '設備費',
  rent: '家賃',
  communication: '通信費',
  other: 'その他',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

    const firstDay = `${month}-01`
    const lastDayNum = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const lastDay = `${month}-${String(lastDayNum).padStart(2, '0')}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    const [salesRes, expensesRes, fixedCostsRes] = await Promise.all([
      db.from('daily_sales')
        .select('date, store_sales, uber_sales, rocketnow_sales, menu_sales, delivery_sales, total_sales, store_orders, uber_orders, rocketnow_orders, menu_orders, delivery_orders, food_cost, labor_cost')
        .eq('tenant_id', TENANT_ID)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date'),
      db.from('expenses')
        .select('date, category, vendor, amount, note, ai_extracted, staff(name)')
        .eq('tenant_id', TENANT_ID)
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date'),
      db.from('fixed_costs')
        .select('category, amount, name')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true),
    ])

    const sales = salesRes.data ?? []
    const expenses = expensesRes.data ?? []
    const fixedCosts = fixedCostsRes.data ?? []

    // 集計
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalSales    = sales.reduce((s: number, r: any) => s + (r.total_sales ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storeSales    = sales.reduce((s: number, r: any) => s + (r.store_sales ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uberSales     = sales.reduce((s: number, r: any) => s + (r.uber_sales ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rocketnowSales = sales.reduce((s: number, r: any) => s + (r.rocketnow_sales ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const menuSales     = sales.reduce((s: number, r: any) => s + (r.menu_sales ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foodCost      = sales.reduce((s: number, r: any) => s + (r.food_cost ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const laborCost     = sales.reduce((s: number, r: any) => s + (r.labor_cost ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenseTotal  = expenses.reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fixedTotal    = fixedCosts.reduce((s: number, r: any) => s + (r.amount ?? 0), 0)

    const grossProfit     = totalSales - foodCost - laborCost
    const operatingProfit = grossProfit - expenseTotal - fixedTotal
    const flRatio         = totalSales > 0 ? Math.round(((foodCost + laborCost) / totalSales) * 100) : 0

    const wb = XLSX.utils.book_new()

    // ===== シート1: PL サマリー =====
    const summaryData = [
      [`${month} 損益計算書（P/L）`, '', ''],
      ['', '', ''],
      ['【売上】', '', ''],
      ['  店内売上',        storeSales,     `${totalSales > 0 ? Math.round((storeSales / totalSales) * 100) : 0}%`],
      ['  Uber Eats',       uberSales,      `${totalSales > 0 ? Math.round((uberSales / totalSales) * 100) : 0}%`],
      ['  ロケットなう',    rocketnowSales, `${totalSales > 0 ? Math.round((rocketnowSales / totalSales) * 100) : 0}%`],
      ['  menu',            menuSales,      `${totalSales > 0 ? Math.round((menuSales / totalSales) * 100) : 0}%`],
      ['売上合計',          totalSales,     '100%'],
      ['', '', ''],
      ['【原価・人件費】', '', ''],
      ['  食材費 (F)',      foodCost,       `${totalSales > 0 ? Math.round((foodCost / totalSales) * 100) : 0}%`],
      ['  人件費 (L)',      laborCost,      `${totalSales > 0 ? Math.round((laborCost / totalSales) * 100) : 0}%`],
      ['  FL合計',          foodCost + laborCost, `${flRatio}%`],
      ['粗利',              grossProfit,    `${totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0}%`],
      ['', '', ''],
      ['【変動費（レシート）】', '', ''],
      ...Object.entries(CATEGORY_LABELS).map(([key, label]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const amt = expenses.filter((e: any) => e.category === key).reduce((s: number, e: any) => s + e.amount, 0)
        return [`  ${label}`, amt, '']
      }),
      ['変動費合計', expenseTotal, ''],
      ['', '', ''],
      ['【固定費】', '', ''],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...fixedCosts.map((f: any) => [`  ${f.name ?? f.category}`, f.amount, '']),
      ['固定費合計', fixedTotal, ''],
      ['', '', ''],
      ['営業利益', operatingProfit, `${totalSales > 0 ? Math.round((operatingProfit / totalSales) * 100) : 0}%`],
    ]

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    summarySheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, summarySheet, 'PLサマリー')

    // ===== シート2: 日別売上 =====
    const salesHeaders = ['日付', '店内売上', 'Uber Eats', 'ロケットなう', 'menu', '売上合計', '店内注文', '配達注文', '食材費', '人件費']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const salesRows = sales.map((r: any) => [
      r.date,
      r.store_sales ?? 0,
      r.uber_sales ?? 0,
      r.rocketnow_sales ?? 0,
      r.menu_sales ?? 0,
      r.total_sales ?? 0,
      r.store_orders ?? 0,
      (r.delivery_orders ?? 0),
      r.food_cost ?? 0,
      r.labor_cost ?? 0,
    ])
    const salesSheet = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows])
    salesSheet['!cols'] = [{ wch: 12 }, ...Array(9).fill({ wch: 12 })]
    XLSX.utils.book_append_sheet(wb, salesSheet, '日別売上')

    // ===== シート3: 経費一覧 =====
    const expHeaders = ['日付', 'カテゴリ', '業者・店名', '金額', 'AI抽出', '担当者', '備考']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expRows = expenses.map((e: any) => [
      e.date,
      CATEGORY_LABELS[e.category] ?? e.category,
      e.vendor ?? '',
      e.amount,
      e.ai_extracted ? '自動' : '手動',
      e.staff?.name ?? '',
      e.note ?? '',
    ])
    const expSheet = XLSX.utils.aoa_to_sheet([expHeaders, ...expRows])
    expSheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, expSheet, '経費一覧')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `PL_${month}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
