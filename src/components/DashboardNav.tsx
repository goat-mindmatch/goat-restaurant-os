'use client'

/**
 * 全ダッシュボードページ共通ボトムナビ
 * ホーム / 注文 / 売上 / シフト / もっと（ドロワー）
 *
 * 「もっと」タップで全ページグリッドが開く
 */

import { useState } from 'react'

const MAIN_NAV = [
  { label: 'ホーム',   href: '/dashboard',             icon: '🏠' },
  { label: '注文',     href: '/dashboard/menu-orders', icon: '🍜' },
  { label: '売上入力', href: '/dashboard/sales',       icon: '💹' },
  { label: 'シフト',   href: '/dashboard/shifts',      icon: '📅' },
]

const MORE_ITEMS = [
  { label: 'テーブル管理', href: '/dashboard/tables',   icon: '🪑' },
  { label: '仕込みタスク', href: '/dashboard/tasks',    icon: '📋' },
  { label: '厨房ディスプレイ', href: '/kitchen',        icon: '👨‍🍳' },
  { label: 'PL損益',     href: '/dashboard/pl',        icon: '📊' },
  { label: '在庫管理',   href: '/dashboard/inventory', icon: '🗃️' },
  { label: '給与計算',   href: '/dashboard/payroll',   icon: '💴' },
  { label: '発注管理',   href: '/dashboard/orders',    icon: '📦' },
  { label: 'メニュー管理', href: '/dashboard/menu-management', icon: '🍽️' },
  { label: '口コミ管理', href: '/dashboard/reviews',          icon: '⭐' },
  { label: 'スタッフRPG', href: '/dashboard/rpg',              icon: '⚔️' },
  { label: 'スタッフ評価', href: '/dashboard/staff-performance', icon: '📈' },
  { label: 'スタッフ',   href: '/dashboard/staff',             icon: '👥' },
  { label: 'メニュー分析', href: '/dashboard/menu-engineering', icon: '🧮' },
  { label: '混雑予測',   href: '/dashboard/forecast',          icon: '🔮' },
  { label: 'SNS投稿',   href: '/dashboard/sns',                icon: '📱' },
  { label: 'ロイヤルティ', href: '/dashboard/loyalty',            icon: '🎁' },
  { label: 'Uber取込',  href: '/dashboard/sales/uber-import',  icon: '🛵' },
  { label: 'AIシフト',  href: '/dashboard/shifts/auto',        icon: '🤖' },
  { label: 'レシート',   href: '/dashboard/receipts',           icon: '🧾' },
  { label: '設定',       href: '/dashboard/settings',           icon: '⚙️' },
]

export default function DashboardNav({ current }: { current: string }) {
  const [open, setOpen] = useState(false)

  const isMoreActive = MORE_ITEMS.some(i => i.href === current)

  return (
    <>
      {/* 「もっと」ドロワー オーバーレイ */}
      {open && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpen(false)}
        >
          {/* ドロワー本体 */}
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-100 px-4 pt-4 pb-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <p className="text-xs font-semibold text-gray-400 mb-3">その他のメニュー</p>
            <div className="grid grid-cols-4 gap-3">
              {MORE_ITEMS.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center py-3 rounded-xl text-xs font-medium transition-colors ${
                    current === item.href
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <span className="text-2xl leading-tight mb-1">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>
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

          {/* もっと ボタン */}
          <button
            onClick={() => setOpen(!open)}
            className={`flex flex-col items-center py-1 text-xs font-medium transition-colors ${
              open || isMoreActive
                ? 'text-orange-600'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="text-xl leading-tight">{open ? '✕' : '⋯'}</span>
            もっと
          </button>
        </div>
      </nav>
    </>
  )
}
