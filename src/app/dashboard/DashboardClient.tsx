'use client'

import { useState } from 'react'

type DashboardData = {
  today: {
    sales: number
    storeOrders: number
    deliveryOrders: number
    lunchSales: number
    dinnerSales: number
    aiComment: string | null
  }
  target: {
    daily: number
    monthly: number
    achievementRate: number | null
    monthAchievementRate: number | null
  }
  month: {
    sales: number
    foodCost: number
    laborCost: number
    flRatio: number | null
    daysElapsed: number
    daysInMonth: number
  }
  labor: {
    budget: number
    estimated: number
    remaining: number
    ratio: number | null
  }
  week: {
    data: { date: string; total_sales: number | null; store_sales: number | null; delivery_sales: number | null }[]
    max: number
  }
  attendance: { staff_id: string; clock_in: string | null; clock_out: string | null; staff: { name: string } | null }[]
  updatedAt: string
}

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center text-xs font-semibold text-gray-500 mb-2"
      >
        <span>{title}</span>
        <span className="text-gray-300 text-base">{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </section>
  )
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const flColor = data.month.flRatio !== null
    ? data.month.flRatio <= 55 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-400'

  const achieveColor = data.target.achievementRate !== null
    ? data.target.achievementRate >= 100 ? 'text-green-600'
    : data.target.achievementRate >= 80  ? 'text-yellow-600'
    : 'text-red-500'
    : 'text-gray-400'

  const laborColor = data.labor.ratio !== null
    ? data.labor.ratio <= 25 ? 'text-green-600' : 'text-red-600'
    : 'text-gray-400'

  return (
    <div className="p-4 pb-24">
      {/* ヘッダー */}
      <div className="mb-3 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GOAT Restaurant OS</h1>
          <p className="text-sm text-gray-500">人類みなまぜそば — 管理ダッシュボード</p>
        </div>
        <p className="text-[10px] text-gray-300">{data.updatedAt}</p>
      </div>

      {/* 本日の売上（常時表示） */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 mb-2">本日の売上</h2>
        <div className="bg-white rounded-xl p-4 shadow-sm mb-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400">売上合計</p>
              <p className="text-3xl font-black text-gray-900">¥{data.today.sales.toLocaleString()}</p>
              {data.today.lunchSales > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  ☀️昼 ¥{data.today.lunchSales.toLocaleString()} / 🌙夜 ¥{data.today.dinnerSales.toLocaleString()}
                </p>
              )}
            </div>
            {data.target.achievementRate !== null && (
              <div className="text-right">
                <p className="text-xs text-gray-400">日次達成率</p>
                <p className={`text-3xl font-black ${achieveColor}`}>{data.target.achievementRate}%</p>
                <p className="text-xs text-gray-400">目標 ¥{data.target.daily.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-400">店内注文</p>
            <p className="text-xl font-bold text-gray-900">{data.today.storeOrders}件</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-xs text-gray-400">デリバリー</p>
            <p className="text-xl font-bold text-gray-900">{data.today.deliveryOrders}件</p>
          </div>
        </div>
      </section>

      {/* AI日報コメント */}
      {data.today.aiComment && (
        <section className="mb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 mb-1">🤖 AI 日報コメント</p>
            <p className="text-sm text-blue-800">{data.today.aiComment}</p>
          </div>
        </section>
      )}

      {/* 7日間トレンド */}
      {data.week.data.length > 0 && (
        <Section title="直近7日間の売上推移" defaultOpen={true}>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-end justify-between gap-1 h-24">
              {data.week.data.map(d => {
                const pct = Math.max(4, Math.round(((d.total_sales ?? 0) / data.week.max) * 100))
                const date = new Date(d.date + 'T00:00:00')
                const dow = DAYS_JP[date.getDay()]
                const dayNum = d.date.slice(8)
                const isToday = d.date === new Date().toISOString().split('T')[0]
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[10px] text-gray-500 leading-none">
                      ¥{Math.round((d.total_sales ?? 0) / 1000)}k
                    </p>
                    <div className="w-full flex items-end" style={{ height: '56px' }}>
                      <div
                        className={`w-full rounded-t-sm ${isToday ? 'bg-blue-500' : 'bg-gray-300'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <p className={`text-[10px] font-semibold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                      {dayNum}/{dow}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      {/* 月次FL管理（アコーディオン） */}
      <Section title="月次 FL 管理" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">月次売上</p>
            <p className="text-xl font-bold text-gray-900">¥{data.month.sales.toLocaleString()}</p>
            {data.target.monthAchievementRate !== null && (
              <p className="text-xs text-gray-400 mt-0.5">
                達成率 <span className={
                  data.target.monthAchievementRate >= 100 ? 'text-green-600 font-bold' : 'text-orange-500 font-bold'
                }>{data.target.monthAchievementRate}%</span>
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">FL比率 (目標 ≤55%)</p>
            <p className={`text-xl font-bold ${flColor}`}>
              {data.month.flRatio !== null ? `${data.month.flRatio}%` : 'データなし'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">食材費 (F)</p>
            <p className="text-lg font-semibold text-gray-700">¥{data.month.foodCost.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-400">人件費 (L)</p>
            <p className="text-lg font-semibold text-gray-700">¥{data.month.laborCost.toLocaleString()}</p>
          </div>
        </div>
      </Section>

      {/* 人件費率リアルタイム（アコーディオン） */}
      {data.labor.budget > 0 && (
        <Section title="人件費率リアルタイム" defaultOpen={false}>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-gray-400">シフト推定人件費</p>
                <p className={`text-2xl font-bold ${laborColor}`}>
                  {data.labor.ratio !== null ? `${data.labor.ratio}%` : '—'}
                </p>
                <p className="text-xs text-gray-400">目標 25% 以内</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">残り使える人件費</p>
                <p className={`text-xl font-bold ${data.labor.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.labor.remaining >= 0 ? '+' : ''}¥{data.labor.remaining.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">予算 ¥{data.labor.budget.toLocaleString()}</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (data.labor.ratio ?? 0) <= 25 ? 'bg-green-400' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (data.labor.ratio ?? 0) * 4)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0%</span>
              <span className="text-green-600 font-bold">目標25%</span>
              <span>30%+</span>
            </div>
          </div>
        </Section>
      )}

      {/* 本日の出勤状況（アコーディオン） */}
      <Section title="本日の出勤状況" defaultOpen={false}>
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {data.attendance.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">本日の打刻データなし</p>
          ) : (
            data.attendance.map(a => (
              <div key={a.staff_id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${a.clock_out ? 'bg-gray-300' : 'bg-green-400'}`} />
                  <span className="text-sm font-medium text-gray-800">
                    {(a.staff as { name: string } | null)?.name ?? '不明'}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {a.clock_in ? a.clock_in.slice(0, 5) : '--:--'}
                  {' 〜 '}
                  {a.clock_out ? a.clock_out.slice(0, 5) : <span className="text-green-600 font-semibold">勤務中</span>}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* クイックリンク */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold text-gray-500 mb-2">管理メニュー</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'シフト管理', href: '/dashboard/shifts',    icon: '📅', desc: '確定・編集' },
            { label: '給与計算',   href: '/dashboard/payroll',   icon: '💴', desc: '今月の給与' },
            { label: '在庫管理',   href: '/dashboard/inventory', icon: '🗃️', desc: '食材・消耗品' },
            { label: '口コミ',     href: '/dashboard/reviews',   icon: '⭐', desc: 'Google連携' },
            { label: 'レシート',   href: '/dashboard/receipts',  icon: '🧾', desc: '経費・OCR' },
            { label: '設定',       href: '/dashboard/settings',  icon: '⚙️', desc: 'LINE設定' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="bg-white rounded-xl p-3 shadow-sm text-center hover:bg-gray-50 transition-colors active:scale-95">
              <p className="text-2xl mb-1">{item.icon}</p>
              <p className="text-xs font-semibold text-gray-800">{item.label}</p>
              <p className="text-[10px] text-gray-400">{item.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
