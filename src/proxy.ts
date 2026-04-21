import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

// 経営者のみアクセス可能なパス
const MANAGER_ONLY_PATHS = [
  '/dashboard',                       // ホーム（売上KPI）
  '/dashboard/sales',                 // 売上入力
  '/dashboard/pl',                    // PL損益
  '/dashboard/inventory',             // 在庫管理
  '/dashboard/payroll',               // 給与計算
  '/dashboard/orders',                // 発注管理
  '/dashboard/menu-management',       // メニュー管理
  '/dashboard/reviews',               // 口コミ管理
  '/dashboard/staff',                 // スタッフ管理
  '/dashboard/menu-engineering',      // メニュー分析
  '/dashboard/forecast',              // 混雑予測
  '/dashboard/sns',                   // SNS投稿
  '/dashboard/loyalty',               // ロイヤルティ
  '/dashboard/sales/delivery-import', // デリバリー取込
  '/dashboard/shifts/auto',           // AIシフト
  '/dashboard/admin-tools',           // 管理者ツール
  '/dashboard/settings',              // 設定
]

// 全スタッフがアクセス可能なパス（ログイン必須）
const ALL_STAFF_PATHS = [
  '/dashboard/menu-orders', // 注文管理
  '/dashboard/shifts',      // シフト確認
  '/dashboard/tables',      // テーブル管理
  '/dashboard/tasks',       // 仕込みタスク
  '/kitchen',               // 厨房ディスプレイ
  '/dashboard/manual',      // まぜそばマニュアル
  '/dashboard/rpg',         // スタッフRPG
  '/dashboard/receipts',    // レシート
]

// 認証不要のパス
const PUBLIC_PATHS = ['/login', '/api/', '/review', '/_next', '/favicon']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 認証不要パスはスルー
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(req)

  // 未ログイン → ログインページへ
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 経営者限定ページへのスタッフアクセスを拒否
  const isManagerOnly = MANAGER_ONLY_PATHS.some(p =>
    pathname === p || pathname.startsWith(p + '/')
  )
  if (isManagerOnly && session.role !== 'manager') {
    // スタッフ向けトップページにリダイレクト
    return NextResponse.redirect(new URL('/dashboard/tasks', req.url))
  }

  // セッション情報をヘッダーに付与（ASCII安全な値のみ）
  const res = NextResponse.next()
  res.headers.set('x-staff-id',   session.staffId)
  res.headers.set('x-staff-role', session.role)
  // 名前は日本語を含むためエンコードしてセット
  res.headers.set('x-staff-name', encodeURIComponent(session.name))
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|review|_next).*)',
  ],
}
