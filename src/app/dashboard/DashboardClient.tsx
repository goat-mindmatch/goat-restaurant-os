'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

async function registerPushNotification() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    alert('このブラウザはプッシュ通知に対応していません')
    return false
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    alert('✅ 通知許可を取得しました（VAPID未設定のためサブスクリプション登録はスキップ）')
    return true
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  })
  const json = sub.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: json.keys,
    }),
  })
  return true
}

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
  tenantName: string
  tables: { empty: number; occupied: number; total: number }
  pendingCallCount: number
  reviewRanking: { name: string; count: number }[]
}

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土']
const RANK_MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

/* ─── 天気バナー ─── */
function WeatherBanner() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&daily=weathercode&timezone=Asia/Tokyo'
    )
      .then(r => r.json())
      .then((d: { daily?: { weathercode?: number[] } }) => {
        const code = d?.daily?.weathercode?.[0]
        if (code === undefined || code === null) return
        let msg: string
        if (code <= 1) {
          msg = '☀️ 晴天予報。テラス席があれば積極的に案内を！'
        } else if (code <= 3) {
          msg = '⛅ 曇り予報。普段通りの営業で問題なし'
        } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
          msg = '☔ 雨予報。デリバリー注文が増える見込みです。Uber Eats在線確認を'
        } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
          msg = '❄️ 雪・悪天候予報。来客数が減る可能性あり。スタッフ配置を見直しましょう'
        } else {
          msg = '🌤️ 本日もよろしくお願いします！'
        }
        setMessage(msg)
      })
      .catch(() => {
        setMessage('🌤️ 本日もよろしくお願いします！')
      })
  }, [])

  if (!message) return null

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm font-medium mb-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
    >
      {message}
    </div>
  )
}

/* ─── アコーディオンセクション ─── */
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
        className="w-full flex justify-between items-center text-xs font-semibold mb-2"
        style={{ color: 'var(--text-sub)' }}
      >
        <span>{title}</span>
        <span className="text-base" style={{ color: 'var(--border)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </section>
  )
}

/* ─── メインコンポーネント ─── */
export default function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter()
  const [notifStatus, setNotifStatus] = useState<'idle' | 'loading' | 'done'>('idle')

  // 30秒ごとの自動更新
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh()
    }, 30000)
    return () => clearInterval(id)
  }, [router])

  const handleNotifClick = async () => {
    setNotifStatus('loading')
    const ok = await registerPushNotification()
    setNotifStatus(ok ? 'done' : 'idle')
  }

  const flColor = data.month.flRatio !== null
    ? data.month.flRatio <= 55 ? '#16a34a' : '#dc2626'
    : 'var(--text-sub)'

  const achieveRate = data.target.achievementRate ?? 0
  const achieveColor = data.target.achievementRate !== null
    ? achieveRate >= 100 ? '#16a34a'
    : achieveRate >= 80  ? '#ca8a04'
    : '#ef4444'
    : 'var(--text-sub)'

  const laborColor = data.labor.ratio !== null
    ? data.labor.ratio <= 25 ? '#16a34a' : '#dc2626'
    : 'var(--text-sub)'

  // 売上プログレスバー
  const salesProgressPct = data.target.daily > 0
    ? Math.min(100, Math.round((data.today.sales / data.target.daily) * 100))
    : 0

  const hasPendingCalls = data.pendingCallCount > 0

  return (
    <div className="p-4 pb-24">

      {/* ─── ヘッダー: 店舗名 + 営業中バッジ + 通知ボタン ─── */}
      <div className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black" style={{ color: 'var(--text)' }}>
            🍜 {data.tenantName ?? 'GOAT Restaurant OS'}
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-sub)' }}>
            {data.updatedAt}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            営業中
          </span>
          {notifStatus !== 'done' ? (
            <button
              onClick={handleNotifClick}
              disabled={notifStatus === 'loading'}
              className="text-[11px] bg-orange-100 text-orange-600 font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
            >
              {notifStatus === 'loading' ? '⏳ 設定中...' : '🔔 通知をON'}
            </button>
          ) : (
            <span className="text-[11px] text-green-600 font-semibold">🔔 通知ON済み</span>
          )}
        </div>
      </div>

      {/* ─── 今日の売上カード（プログレスバー付き）─── */}
      <section className="mb-4">
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-sub)' }}>💰 今日の売上</p>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-3xl font-black" style={{ color: 'var(--text)' }}>
                ¥{data.today.sales.toLocaleString()}
              </p>
              {data.target.daily > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-sub)' }}>
                  目標 ¥{data.target.daily.toLocaleString()}
                </p>
              )}
            </div>
            {data.target.achievementRate !== null && (
              <p className="text-3xl font-black" style={{ color: achieveColor }}>
                {data.target.achievementRate}%
              </p>
            )}
          </div>
          {/* プログレスバー */}
          {data.target.daily > 0 && (
            <>
              <div className="w-full rounded-full h-3 mb-1" style={{ background: 'var(--border)' }}>
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${salesProgressPct}%`,
                    background: achieveRate >= 100 ? '#16a34a' : achieveRate >= 80 ? '#ca8a04' : '#3b82f6',
                  }}
                />
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>
                達成率 {salesProgressPct}%
              </p>
            </>
          )}
          {data.today.lunchSales > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-sub)' }}>
              ☀️昼 ¥{data.today.lunchSales.toLocaleString()} / 🌙夜 ¥{data.today.dinnerSales.toLocaleString()}
            </p>
          )}
        </div>
      </section>

      {/* ─── テーブル空席 + 呼び出し件数（2列） ─── */}
      <section className="mb-4 grid grid-cols-2 gap-3">
        <a
          href="/dashboard/tables"
          className="rounded-2xl p-4 shadow-sm flex flex-col gap-1 active:scale-95 transition-transform"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-sub)' }}>🪑 テーブル</p>
          <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            空き {data.tables?.empty ?? 0}
            <span className="text-sm font-medium">/{data.tables?.total ?? 0}席</span>
          </p>
          <p className="text-xs" style={{ color: 'var(--text-sub)' }}>
            注文中 {data.tables?.occupied ?? 0}席
          </p>
        </a>

        <a
          href="/dashboard/tables"
          className="rounded-2xl p-4 shadow-sm flex flex-col gap-1 active:scale-95 transition-transform relative overflow-hidden"
          style={{
            background: hasPendingCalls ? '#fef2f2' : 'var(--surface)',
            border: hasPendingCalls ? '2px solid #fca5a5' : '1px solid var(--border)',
          }}
        >
          <p className="text-xs font-semibold" style={{ color: hasPendingCalls ? '#b91c1c' : 'var(--text-sub)' }}>
            📣 呼び出し
          </p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black" style={{ color: hasPendingCalls ? '#b91c1c' : 'var(--text)' }}>
              {data.pendingCallCount ?? 0}件
            </p>
            {hasPendingCalls && (
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse inline-block" />
            )}
          </div>
          <p className="text-xs" style={{ color: hasPendingCalls ? '#b91c1c' : 'var(--text-sub)' }}>
            {hasPendingCalls ? '未対応あり' : '未対応なし'}
          </p>
        </a>
      </section>

      {/* ─── 天気バナー ─── */}
      <WeatherBanner />

      {/* ─── 今日の口コミランキング ─── */}
      {(data.reviewRanking?.length ?? 0) > 0 && (
        <section className="mb-4">
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-sub)' }}>⭐ 今日の口コミランキング</p>
            <div className="space-y-2">
              {data.reviewRanking.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{RANK_MEDAL[i] ?? '🏅'}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.name}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-sub)' }}>{r.count}件</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── 今月の経営健康度 ─── */}
      <section className="mb-4">
        <div
          className="rounded-2xl p-4 shadow-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-sub)' }}>📊 今月の経営健康度</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-sub)' }}>FL比率 (≤55%目標)</p>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                  style={{ background: data.month.flRatio !== null && data.month.flRatio <= 55 ? '#16a34a' : '#dc2626' }}
                />
                <span className="text-lg font-black" style={{ color: flColor }}>
                  {data.month.flRatio !== null ? `${data.month.flRatio}%` : '—'}
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-sub)' }}>
                {data.month.flRatio !== null && data.month.flRatio <= 55 ? '良好' : '要注意'}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-sub)' }}>月次売上達成率</p>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                  style={{ background: (data.target.monthAchievementRate ?? 0) >= 80 ? '#16a34a' : '#dc2626' }}
                />
                <span
                  className="text-lg font-black"
                  style={{
                    color: (data.target.monthAchievementRate ?? 0) >= 100 ? '#16a34a'
                      : (data.target.monthAchievementRate ?? 0) >= 80 ? '#ca8a04'
                      : '#ef4444'
                  }}
                >
                  {data.target.monthAchievementRate !== null ? `${data.target.monthAchievementRate}%` : '—'}
                </span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-sub)' }}>
                月次 ¥{data.month.sales.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI日報コメント ─── */}
      {data.today.aiComment && (
        <section className="mb-4">
          <div className="rounded-xl p-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <p className="text-xs font-semibold text-blue-600 mb-1">🤖 AI 日報コメント</p>
            <p className="text-sm text-blue-800">{data.today.aiComment}</p>
          </div>
        </section>
      )}

      {/* ─── 7日間トレンド ─── */}
      {data.week.data.length > 0 && (
        <Section title="直近7日間の売上推移" defaultOpen={true}>
          <div
            className="rounded-2xl p-4 shadow-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-end justify-between gap-1 h-24">
              {data.week.data.map(d => {
                const pct = Math.max(4, Math.round(((d.total_sales ?? 0) / data.week.max) * 100))
                const date = new Date(d.date + 'T00:00:00')
                const dow = DAYS_JP[date.getDay()]
                const dayNum = d.date.slice(8)
                const isToday = d.date === new Date().toISOString().split('T')[0]
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[10px] leading-none" style={{ color: 'var(--text-sub)' }}>
                      ¥{Math.round((d.total_sales ?? 0) / 1000)}k
                    </p>
                    <div className="w-full flex items-end" style={{ height: '56px' }}>
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${pct}%`,
                          background: isToday ? '#3b82f6' : 'var(--border)',
                        }}
                      />
                    </div>
                    <p
                      className="text-[10px] font-semibold"
                      style={{ color: isToday ? '#3b82f6' : 'var(--text-sub)' }}
                    >
                      {dayNum}/{dow}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ─── 月次FL管理 ─── */}
      <Section title="月次 FL 管理" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: '月次売上',
              value: `¥${data.month.sales.toLocaleString()}`,
              sub: data.target.monthAchievementRate !== null
                ? `達成率 ${data.target.monthAchievementRate}%`
                : undefined,
              subColor: (data.target.monthAchievementRate ?? 0) >= 100 ? '#16a34a' : '#f97316',
            },
            {
              label: 'FL比率 (目標 ≤55%)',
              value: data.month.flRatio !== null ? `${data.month.flRatio}%` : 'データなし',
              valueColor: flColor,
            },
            {
              label: '食材費 (F)',
              value: `¥${data.month.foodCost.toLocaleString()}`,
            },
            {
              label: '人件費 (L)',
              value: `¥${data.month.laborCost.toLocaleString()}`,
            },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-4 shadow-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-sub)' }}>{item.label}</p>
              <p className="text-xl font-bold" style={{ color: item.valueColor ?? 'var(--text)' }}>
                {item.value}
              </p>
              {item.sub && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-sub)' }}>
                  <span style={{ color: item.subColor, fontWeight: 700 }}>{item.sub}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ─── 人件費率リアルタイム ─── */}
      {data.labor.budget > 0 && (
        <Section title="人件費率リアルタイム" defaultOpen={false}>
          <div
            className="rounded-xl p-4 shadow-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-sub)' }}>シフト推定人件費</p>
                <p className="text-2xl font-bold" style={{ color: laborColor }}>
                  {data.labor.ratio !== null ? `${data.labor.ratio}%` : '—'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-sub)' }}>目標 25% 以内</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-sub)' }}>残り使える人件費</p>
                <p className="text-xl font-bold"
                  style={{ color: data.labor.remaining >= 0 ? '#16a34a' : '#dc2626' }}>
                  {data.labor.remaining >= 0 ? '+' : ''}¥{data.labor.remaining.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-sub)' }}>予算 ¥{data.labor.budget.toLocaleString()}</p>
              </div>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: 'var(--border)' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (data.labor.ratio ?? 0) * 4)}%`,
                  background: (data.labor.ratio ?? 0) <= 25 ? '#4ade80' : '#ef4444',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-sub)' }}>
              <span>0%</span>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>目標25%</span>
              <span>30%+</span>
            </div>
          </div>
        </Section>
      )}

      {/* ─── 本日の出勤状況 ─── */}
      <Section title="本日の出勤状況" defaultOpen={false}>
        <div
          className="rounded-xl shadow-sm overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {data.attendance.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: 'var(--text-sub)' }}>本日の打刻データなし</p>
          ) : (
            data.attendance.map(a => (
              <div
                key={a.staff_id}
                className="flex items-center justify-between p-4"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${a.clock_out ? 'bg-gray-300' : 'bg-green-400'}`} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {(a.staff as { name: string } | null)?.name ?? '不明'}
                  </span>
                </div>
                <span className="text-sm" style={{ color: 'var(--text-sub)' }}>
                  {a.clock_in ? a.clock_in.slice(0, 5) : '--:--'}
                  {' 〜 '}
                  {a.clock_out
                    ? a.clock_out.slice(0, 5)
                    : <span style={{ color: '#16a34a', fontWeight: 700 }}>勤務中</span>
                  }
                </span>
              </div>
            ))
          )}
        </div>
        <a
          href="/dashboard/shifts"
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs py-1 transition-colors"
          style={{ color: 'var(--text-sub)' }}
        >
          ✏️ 打刻を手動修正する →
        </a>
      </Section>

      {/* ─── 管理メニュー ─── */}
      <section className="mb-4">
        <h2 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-sub)' }}>管理メニュー</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'シフト管理', href: '/dashboard/shifts',    icon: '📅', desc: '確定・編集' },
            { label: '給与計算',   href: '/dashboard/payroll',   icon: '💴', desc: '今月の給与' },
            { label: '在庫管理',   href: '/dashboard/inventory', icon: '🗃️', desc: '食材・消耗品' },
            { label: '口コミ',     href: '/dashboard/reviews',   icon: '⭐', desc: 'Google連携' },
            { label: 'レシート',   href: '/dashboard/receipts',  icon: '🧾', desc: '経費・OCR' },
            { label: '設定',       href: '/dashboard/settings',  icon: '⚙️', desc: 'LINE設定' },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl p-3 shadow-sm text-center active:scale-95 transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-2xl mb-1">{item.icon}</p>
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{item.label}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>{item.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
