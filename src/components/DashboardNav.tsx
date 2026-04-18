/**
 * 全ダッシュボードページ共通ボトムナビ
 * ホーム / 注文 / 売上 / 発注 / PL
 */

const NAV_ITEMS = [
  { label: 'ホーム', href: '/dashboard',              icon: '🏠' },
  { label: '注文',   href: '/dashboard/menu-orders',  icon: '🍜' },
  { label: '売上',   href: '/dashboard/sales',        icon: '💹' },
  { label: '発注',   href: '/dashboard/orders',       icon: '📦' },
  { label: 'PL',     href: '/dashboard/pl',           icon: '📋' },
]

export default function DashboardNav({ current }: { current: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {NAV_ITEMS.map(item => (
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
      </div>
    </nav>
  )
}
