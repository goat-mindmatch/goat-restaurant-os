export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/payroll/send-slip?month=YYYY-MM&secret=xxx
 * cronから月末25日に実行
 * 各スタッフに給与明細Flex Messageを送信し、受領確認ボタンを添付
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendFlexMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const CRON_SECRET = process.env.CRON_SECRET

// HH:MM → 分に変換
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// 22:00以降の深夜時間（分）を計算
function lateNightMinutes(clockIn: string, clockOut: string): number {
  const LATE_START = 22 * 60 // 22:00 = 1320分
  const inMin = toMinutes(clockIn)
  const outMin = toMinutes(clockOut)
  // 日をまたぐ場合は翌日分として計算（最大翌3:00 = 27:00 = 1620分）
  const adjustedOut = outMin < inMin ? outMin + 24 * 60 : outMin
  const lateIn = Math.max(inMin, LATE_START)
  const lateOut = Math.min(adjustedOut, LATE_START + 8 * 60) // 深夜は最大8時間
  return Math.max(0, lateOut - lateIn)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const month = searchParams.get('month') // YYYY-MM

  // 認証チェック
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 月指定がなければ今月
  const targetMonth = month ?? new Date().toISOString().slice(0, 7)
  const [yearStr, monthStr] = targetMonth.split('-')
  const year = parseInt(yearStr)
  const monthNum = parseInt(monthStr)
  const displayMonth = monthNum // 表示用月数

  const firstDay = `${targetMonth}-01`
  const lastDayNum = new Date(year, monthNum, 0).getDate()
  const lastDay = `${targetMonth}-${String(lastDayNum).padStart(2, '0')}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  try {
    // LINE登録済みのアクティブスタッフ取得
    const { data: staffList, error: staffErr } = await db
      .from('staff')
      .select('id, name, line_user_id, hourly_wage, transport_fee')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .not('line_user_id', 'is', null)

    if (staffErr) throw staffErr

    const results: { name: string; status: string }[] = []

    for (const staff of staffList ?? []) {
      try {
        // 指定月の勤怠を取得
        const { data: attendanceRows } = await db
          .from('attendance')
          .select('date, clock_in, clock_out, work_minutes')
          .eq('tenant_id', TENANT_ID)
          .eq('staff_id', staff.id)
          .gte('date', firstDay)
          .lte('date', lastDay)
          .not('clock_in', 'is', null)

        const attendance = attendanceRows ?? []

        // 勤怠集計
        let totalWorkMinutes = 0
        let totalLateNightMinutes = 0
        const workDates = new Set<string>()

        for (const row of attendance) {
          if (row.work_minutes) {
            totalWorkMinutes += row.work_minutes
          } else if (row.clock_in && row.clock_out) {
            const mins = toMinutes(row.clock_out) - toMinutes(row.clock_in)
            totalWorkMinutes += Math.max(0, mins)
          }

          if (row.clock_in && row.clock_out) {
            totalLateNightMinutes += lateNightMinutes(row.clock_in, row.clock_out)
            workDates.add(row.date)
          } else if (row.clock_in) {
            workDates.add(row.date)
          }
        }

        const totalDays = workDates.size
        const totalHours = Math.floor(totalWorkMinutes / 60)
        const remainMinutes = totalWorkMinutes % 60
        const totalLateNightHours = totalLateNightMinutes / 60

        // 口コミ獲得数（verified=true）
        const { data: reviewRows } = await db
          .from('review_submissions')
          .select('id')
          .eq('tenant_id', TENANT_ID)
          .eq('staff_id', staff.id)
          .eq('verified', true)
          .gte('created_at', `${firstDay}T00:00:00`)
          .lte('created_at', `${lastDay}T23:59:59`)

        const reviewCount = (reviewRows ?? []).length

        // 給与計算
        const hourlyWage = staff.hourly_wage ?? 0
        const transportFee = staff.transport_fee ?? 0

        const basePay = Math.round((totalWorkMinutes / 60) * hourlyWage)
        const lateNightPremium = Math.round(totalLateNightHours * hourlyWage * 0.25)
        const transportTotal = totalDays * transportFee
        const reviewBonus = reviewCount * 100
        const total = basePay + lateNightPremium + transportTotal + reviewBonus

        // 受領確認のpostbackデータ用キー
        const confirmKey = `payroll_confirm_${staff.id}_${targetMonth}`

        // Flex Message 組み立て
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flexContents: Record<string, any> = {
          type: 'bubble',
          size: 'mega',
          header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#1e3a5f',
            paddingAll: '16px',
            contents: [
              {
                type: 'text',
                text: `💴 ${displayMonth}月分 給与明細`,
                color: '#ffffff',
                weight: 'bold',
                size: 'lg',
              },
            ],
          },
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            spacing: 'sm',
            contents: [
              {
                type: 'text',
                text: `${staff.name} 様`,
                weight: 'bold',
                size: 'md',
                color: '#1a1a1a',
                margin: 'none',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'md',
                contents: [
                  { type: 'text', text: '勤務日数', size: 'sm', color: '#555555', flex: 3 },
                  { type: 'text', text: `${totalDays}日`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '総勤務時間', size: 'sm', color: '#555555', flex: 3 },
                  { type: 'text', text: `${totalHours}時間${remainMinutes}分`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
                ],
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'md',
                contents: [
                  { type: 'text', text: '基本給', size: 'sm', color: '#555555', flex: 3 },
                  { type: 'text', text: `¥${basePay.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '深夜割増', size: 'sm', color: '#555555', flex: 3 },
                  { type: 'text', text: `¥${lateNightPremium.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '交通費', size: 'sm', color: '#555555', flex: 3 },
                  { type: 'text', text: `¥${transportTotal.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#1a1a1a', flex: 2, align: 'end' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '口コミボーナス', size: 'sm', color: '#555555', flex: 3 },
                  { type: 'text', text: `¥${reviewBonus.toLocaleString()}`, size: 'sm', weight: 'bold', color: reviewBonus > 0 ? '#DC2626' : '#1a1a1a', flex: 2, align: 'end' },
                ],
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'md',
                contents: [
                  { type: 'text', text: '合計支給額', size: 'md', weight: 'bold', color: '#1e3a5f', flex: 3 },
                  { type: 'text', text: `¥${total.toLocaleString()}`, size: 'md', weight: 'bold', color: '#1e3a5f', flex: 2, align: 'end' },
                ],
              },
            ],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#1e3a5f',
                action: {
                  type: 'postback',
                  label: '✅ 受領確認',
                  data: `action=payroll_confirm&staff_id=${staff.id}&month=${targetMonth}&key=${confirmKey}`,
                  displayText: `${displayMonth}月分給与明細を受領しました`,
                },
                height: 'md',
              },
            ],
          },
        }

        await sendFlexMessage(
          staff.line_user_id,
          `💴 ${displayMonth}月分給与明細 - ${staff.name}様`,
          flexContents
        )

        results.push({ name: staff.name, status: 'sent' })
      } catch (e) {
        console.error(`Failed to send payslip to ${staff.name}:`, e)
        results.push({ name: staff.name, status: `error: ${(e as Error).message}` })
      }
    }

    return NextResponse.json({
      ok: true,
      month: targetMonth,
      sent: results.filter(r => r.status === 'sent').length,
      total: results.length,
      results,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
