'use client'

/**
 * スタッフRPGランキング — クライアントコンポーネント
 */

import DashboardNav from '@/components/DashboardNav'
import type { StaffRPGData } from './page'

const RANK_COLORS: Record<number, { border: string; bg: string; badge: string }> = {
  1: { border: 'border-yellow-400',  bg: 'bg-yellow-50',  badge: '🥇' },
  2: { border: 'border-gray-400',    bg: 'bg-gray-50',    badge: '🥈' },
  3: { border: 'border-amber-600',   bg: 'bg-amber-50',   badge: '🥉' },
}

function ExpBar({ exp, level }: { exp: number; level: number }) {
  const currentLevelExp = (level - 1) * 1000
  const nextLevelExp    = level * 1000
  const progress = Math.min(100, Math.round(((exp - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100))
  const remaining = nextLevelExp - exp

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{exp.toLocaleString()} EXP</span>
        <span>次のLvまで {remaining.toLocaleString()} EXP</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-gradient-to-r from-orange-400 to-orange-600 h-2.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function StaffCard({ staff }: { staff: StaffRPGData }) {
  const color = RANK_COLORS[staff.rank]
  const borderClass = color?.border ?? 'border-gray-200'
  const bgClass     = color?.bg     ?? 'bg-white'
  const rankBadge   = color?.badge  ?? `#${staff.rank}`

  return (
    <div className={`rounded-2xl border-2 ${borderClass} ${bgClass} p-4 shadow-sm`}>
      {/* ヘッダー行 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{rankBadge}</span>
          <div>
            <p className="font-bold text-gray-800 text-base leading-tight">{staff.name}</p>
            <p className="text-xs text-gray-500">{staff.title}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
            Lv.{staff.level}
          </div>
        </div>
      </div>

      {/* 統計行 */}
      <div className="flex gap-4 mt-3 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <span>⭐</span>
          <span>口コミ <strong className="text-gray-800">{staff.monthlyReviews}</strong> 件</span>
        </div>
        <div className="flex items-center gap-1">
          <span>📅</span>
          <span>出勤 <strong className="text-gray-800">{staff.workDays}</strong> 日</span>
        </div>
      </div>

      {/* バッジ */}
      {staff.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {staff.badges.map((b) => (
            <span
              key={b}
              className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      {/* EXPバー */}
      <ExpBar exp={staff.exp} level={staff.level} />
    </div>
  )
}

type Props = {
  staffList: StaffRPGData[]
  currentMonth: string
}

export default function RPGClient({ staffList, currentMonth }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 pt-12 pb-6 text-white">
        <h1 className="text-xl font-bold tracking-tight">⚔️ スタッフRPGランキング</h1>
        <p className="text-sm text-orange-100 mt-0.5">{currentMonth} / 全{staffList.length}名</p>
      </div>

      {/* 凡例 */}
      <div className="bg-orange-50 border-b border-orange-100 px-4 py-2.5 text-xs text-orange-700 flex flex-wrap gap-3">
        <span>勤怠1日 = 50 EXP</span>
        <span>口コミ1件 = 150 EXP</span>
        <span>遅刻ゼロ週 = 100 EXP</span>
      </div>

      {/* ランキングリスト */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        {staffList.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="text-4xl mb-2">🎮</p>
            <p className="text-sm">スタッフデータがありません</p>
          </div>
        )}
        {staffList.map((s) => (
          <StaffCard key={s.staffId} staff={s} />
        ))}
      </div>

      <DashboardNav current="/dashboard/rpg" />
    </div>
  )
}
