'use client'

/**
 * 全ダッシュボードページ共通ボトムナビ
 * ホーム / 売上 / タスク / シフト / もっと（カテゴリ分けドロワー）
 *
 * バッジ機能:
 *   /dashboard/improvements の未対応件数を起動時に取得し、
 *   「もっと」ボタンと改善申告アイテムに赤バッジで表示する。
 */

import { useState, useEffect } from 'react'

const MAIN_NAV = [
  { label: 'ホーム',   href: '/dashboard',          icon: '🏠' },
  { label: '売上',     href: '/dashboard/sales',    icon: '💹' },
  { label: 'タスク',   href: '/dashboard/tasks',    icon: '📋' },
  { label: 'シフト',   href: '/dashboard/shifts',   icon: '📅' },
]

type NavItem = { label: string; href: string; icon: string }

// バッジを表示するhref（pending件数を重ねる）
const BADGE_HREF = '/dashboard/improvements'

const CATEGORIES: { title: string; items: NavItem[]; note?: string }[] = [
  {
    title: '📊 売上・財務',
    items: [
      { label: '売上管理',  href: '/dashboard/sales',            icon: '💹' },
      { label: '現金精算',  href: '/dashboard/cash-register',    icon: '💴' },
      { label: 'PL損益',   href: '/dashboard/pl',                icon: '📈' },
      { label: 'レシート',  href: '/dashboard/receipts',         icon: '🧾' },
    ],
  },
  {
    title: '👥 スタッフ',
    items: [
      { label: 'スタッフ',    href: '/dashboard/staff',        icon: '👥' },
      { label: 'シフト',      href: '/dashboard/shifts',       icon: '📅' },
      { label: 'AIシフト',    href: '/dashboard/shifts/auto',  icon: '🤖' },
      { label: '給与計算',    href: '/dashboard/payroll',      icon: '💰' },
      { label: 'スタッフRPG', href: '/dashboard/rpg',          icon: '⚔️' },
      { label: 'マニュアル',  href: '/dashboard/manual',       icon: '📖' },
      { label: '意見箱',      href: '/improve',                icon: '💡' },
    ],
  },
  {
    title: '📣 集客・マーケティング',
    items: [
      { label: '口コミ管理',   href: '/dashboard/reviews',          icon: '⭐' },
      { label: 'ロイヤルティ', href: '/dashboard/loyalty',          icon: '🎁' },
      { label: 'SNS投稿',     href: '/dashboard/sns',               icon: '📱' },
      { label: '混雑予測',    href: '/dashboard/forecast',          icon: '🔮' },
      { label: 'メニュー分析', href: '/dashboard/menu-engineering', icon: '🧮' },
    ],
  },
  {
    title: '🏪 店舗運営',
    items: [
      { label: '在庫管理', href: '/dashboard/inventory', icon: '🗃️' },
      { label: '発注管理', href: '/dashboard/orders',    icon: '📦' },
    ],
  },
  {
    title: '🔜 今後開始予定',
    note: '準備中',
    items: [
      { label: 'メニュー管理',     href: '/dashboard/menu-management', icon: '🍽️' },
      { label: 'テーブル管理',     href: '/dashboard/tables',          icon: '🪑' },
      { label: '厨房ディスプレイ', href: '/kitchen',                   icon: '👨‍🍳' },
      { label: 'モバイル注文',     href: '/dashboard/menu-orders',     icon: '🍜' },
    ],
  },
  {
    title: '⚙️ 設定・管理',
    items: [
      { label: '改善申告',     href: '/dashboard/improvements', icon: '📋' },
      { label: '管理者ツール', href: '/dashboard/admin-tools',  icon: '🛠️' },
      { label: '設定',         href: '/dashboard/settings',    icon: '⚙️' },
    ],
  },
]

const ALL_MORE_ITEMS = CATEGORIES.flatMap(c => c.items)

export default function DashboardNav({ current }: { current: string }) {
  const [open, setOpen]               = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // 未対応の改善申告件数を取得（マウント時1回）
  useEffect(() => {
    fetch('/api/improvements?status=pending')
      .then(r => r.json())
      .then(j => setPendingCount(j.data?.length ?? 0))
      .catch(() => {})
  }, [])

  const isMoreActive = ALL_MORE_ITEMS.some(i => i.href === current)
  const hasBadge     = pendingCount > 0

  return (
    <>
      {/* ドロワー オーバーレイ */}
      {open && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpen(false)}
        >
          {/* ドロワー本体 */}
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-100 px-4 pt-4 pb-8 overflow-y-auto"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {CATEGORIES.map(cat => (
              <div key={cat.title} className="mb-5">
                {/* カテゴリヘッダー */}
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-bold text-gray-600">{cat.title}</p>
                  {cat.note && (
                    <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                      {cat.note}
                    </span>
                  )}
                </div>

                {/* アイテムグリッド */}
                <div className="grid grid-cols-4 gap-2">
                  {cat.items.map(item => {
                    const isBadgeItem = item.href === BADGE_HREF && hasBadge
                    const isActive    = current === item.href

                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className={`relative flex flex-col items-center py-3 rounded-xl text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-orange-50 text-orange-600'
                            : cat.note
                              ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                              : 'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        {/* バッジ */}
                        {isBadgeItem && (
                          <span
                            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none"
                          >
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        )}
                        <span className="text-2xl leading-tight mb-1">{item.icon}</span>
                        <span className="text-center leading-tight">{item.label}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {MAIN_NAV.map(item => (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 text-xs font-medium transition-colors ${
                current === item.href
                  ? 'text-orange-600'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <span className="text-xl leading-tight">{item.icon}</span>
              {item.label}
            </a>
          ))}

          {/* もっと ボタン（バッジあり） */}
          <button
            onClick={() => setOpen(!open)}
            className={`relative flex flex-col items-center py-1 text-xs font-medium transition-colors ${
              open || isMoreActive
                ? 'text-orange-600'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {/* 未対応バッジ */}
            {hasBadge && !open && (
              <span className="absolute top-0 right-2 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            <span className="text-xl leading-tight">{open ? '✕' : '⋯'}</span>
            もっと
          </button>
        </div>
      </nav>
    </>
  )
}
