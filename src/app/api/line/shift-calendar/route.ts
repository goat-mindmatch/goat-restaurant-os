export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/line/shift-calendar
 * body: { lineUserId, staffId, year, month }
 *
 * 指定スタッフの月シフトをカレンダー形式のFlex Messageで送信
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendFlexMessage } from '@/lib/line-staff'

const TENANT_ID = process.env.TENANT_ID!
const DASHBOARD_URL = 'https://goat-restaurant-os.vercel.app/dashboard/shifts'

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lineUserId, staffId, year, month } = body as {
      lineUserId: string
      staffId: string
      year: number
      month: number
    }

    if (!lineUserId || !staffId || !year || !month) {
      return NextResponse.json({ error: 'lineUserId, staffId, year, month は必須です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any

    // スタッフ情報取得
    const { data: staffData } = await db
      .from('staff')
      .select('id, name')
      .eq('tenant_id', TENANT_ID)
      .eq('id', staffId)
      .single()

    const staff = staffData as { id: string; name: string } | null
    if (!staff) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
    }

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDayNum = new Date(year, month, 0).getDate()
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`

    // シフトと希望を並列取得
    const [shiftsRes, requestsRes] = await Promise.all([
      db
        .from('shifts')
        .select('date, start_time, end_time')
        .eq('tenant_id', TENANT_ID)
        .eq('staff_id', staffId)
        .gte('date', firstDay)
        .lte('date', lastDay),
      db
        .from('shift_requests')
        .select('available_dates')
        .eq('tenant_id', TENANT_ID)
        .eq('staff_id', staffId)
        .eq('target_year', year)
        .eq('target_month', month)
        .single(),
    ])

    const shifts = shiftsRes.data ?? []
    const requestDates: string[] = requestsRes.data?.available_dates ?? []

    // シフトあり日のSet
    const shiftDateSet = new Set<string>(
      (shifts as { date: string }[]).map(s => s.date)
    )
    const requestDateSet = new Set<string>(requestDates)

    // 今日（JST）
    const todayJST = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
    ).toISOString().split('T')[0]

    // カレンダーグリッド構築（7列 × 5行）
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=日〜6=土

    // ヘッダー行（曜日）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerRow: Record<string, any> = {
      type: 'box',
      layout: 'horizontal',
      contents: DAYS_JP.map((d, i) => ({
        type: 'text',
        text: d,
        size: 'xxs',
        color: i === 0 ? '#DC2626' : i === 6 ? '#2563EB' : '#888888',
        align: 'center',
        flex: 1,
      })),
    }

    // カレンダーセル配列（6週分のスロット）
    const totalCells = 42 // 6週 × 7日
    const cells: Array<{
      day: number | null
      dateStr: string | null
      isShift: boolean
      isRequest: boolean
      isToday: boolean
    }> = []

    // 先頭の空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateStr: null, isShift: false, isRequest: false, isToday: false })
    }
    // 日付セル
    for (let d = 1; d <= lastDayNum; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({
        day: d,
        dateStr,
        isShift: shiftDateSet.has(dateStr),
        isRequest: requestDateSet.has(dateStr),
        isToday: dateStr === todayJST,
      })
    }
    // 末尾の空白
    while (cells.length < totalCells) {
      cells.push({ day: null, dateStr: null, isShift: false, isRequest: false, isToday: false })
    }

    // 週ごとに行を生成（実際に使う週だけ = 先頭空白含め最大6週）
    const weekCount = Math.ceil(cells.length / 7)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calendarRows: Record<string, any>[] = []

    for (let w = 0; w < weekCount; w++) {
      const weekCells = cells.slice(w * 7, w * 7 + 7)
      // 全て空白行はスキップ
      if (weekCells.every(c => c.day === null)) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowContents: Record<string, any>[] = weekCells.map(cell => {
        if (cell.day === null) {
          return {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            contents: [{ type: 'text', text: ' ', size: 'xxs', color: '#ffffff' }],
          }
        }
        const bgColor = cell.isShift ? '#ea580c' : '#e5e7eb'
        const textColor = cell.isShift ? '#ffffff' : '#6b7280'
        const marker = cell.isShift ? '●' : '○'

        return {
          type: 'box',
          layout: 'vertical',
          flex: 1,
          backgroundColor: bgColor,
          cornerRadius: '4px',
          paddingAll: '2px',
          margin: '2px',
          contents: [
            {
              type: 'text',
              text: String(cell.day),
              size: 'xxs',
              color: textColor,
              align: 'center',
              weight: cell.isToday ? 'bold' : 'regular',
            },
            {
              type: 'text',
              text: marker,
              size: 'xxs',
              color: textColor,
              align: 'center',
            },
          ],
        }
      })

      calendarRows.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'xs',
        contents: rowContents,
      })
    }

    const shiftCount = shiftDateSet.size

    // Flex Message 組み立て
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flexContents: Record<string, any> = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#ea580c',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: `📅 ${staff.name}さんの${month}月シフト`,
            color: '#ffffff',
            weight: 'bold',
            size: 'md',
          },
          {
            type: 'text',
            text: `${year}年`,
            color: '#fed7aa',
            size: 'sm',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        spacing: 'xs',
        contents: [
          headerRow,
          { type: 'separator', margin: 'xs' },
          ...calendarRows,
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: '出勤予定', size: 'sm', color: '#555555', flex: 3 },
              {
                type: 'text',
                text: `${shiftCount}日`,
                size: 'sm',
                weight: 'bold',
                color: '#ea580c',
                flex: 2,
                align: 'end',
              },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                flex: 1,
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#ea580c',
                    cornerRadius: '2px',
                    contents: [],
                  },
                  { type: 'text', text: ' ● 出勤あり', size: 'xxs', color: '#666666', margin: 'xs' },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                flex: 1,
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#e5e7eb',
                    cornerRadius: '2px',
                    contents: [],
                  },
                  { type: 'text', text: ' ○ 出勤なし', size: 'xxs', color: '#666666', margin: 'xs' },
                ],
              },
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
            style: 'secondary',
            action: {
              type: 'uri',
              label: '📋 ダッシュボードで詳細確認',
              uri: DASHBOARD_URL,
            },
            height: 'sm',
          },
        ],
      },
    }

    await sendFlexMessage(
      lineUserId,
      `📅 ${staff.name}さんの${month}月シフト（${shiftCount}日出勤予定）`,
      flexContents
    )

    return NextResponse.json({ ok: true, staffName: staff.name, month, shiftCount })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
