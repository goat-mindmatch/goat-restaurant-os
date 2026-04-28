'use client'

/**
 * 経営者向け 機能マップ UI
 * 全機能をカテゴリ別・説明付きで一覧表示
 */

import DashboardNav from '@/components/DashboardNav'

type FeatureItem = {
  icon: string
  label: string
  description: string
  href: string
  badge?: number
  status?: 'active' | 'coming'
}

type FeatureCategory = {
  icon: string
  title: string
  color: string
  bg: string
  items: FeatureItem[]
}

export default function FeaturesClient({
  pendingImprovements,
}: {
  pendingImprovements: number
}) {
  const CATEGORIES: FeatureCategory[] = [
    {
      icon: '💹',
      title: '売上・財務管理',
      color: '#10b981',
      bg: '#052e16',
      items: [
        {
          icon: '💹',
          label: '売上管理',
          href: '/dashboard/sales',
          description: '日次・月次の売上を入力・確認。Uber Eats・Rocketnowのデータも自動連携。目標達成率をリアルタイムで把握できます。',
        },
        {
          icon: '💴',
          label: '現金精算',
          href: '/dashboard/cash-register',
          description: '日次の現金残高・釣銭の管理。閉店時の精算作業をデジタルで記録し、ミスを防ぎます。',
        },
        {
          icon: '📈',
          label: 'PL損益',
          href: '/dashboard/pl',
          description: '月次の損益計算書（P/L）を自動生成。売上・原価・人件費・FL比率を一目で把握できます。',
        },
        {
          icon: '🧾',
          label: 'レシート管理',
          href: '/dashboard/receipts',
          description: '領収書・レシートをスマホで撮影して保管。経費精算・税務処理に活用できます。',
        },
      ],
    },
    {
      icon: '👥',
      title: 'スタッフ管理',
      color: '#3b82f6',
      bg: '#1e3a8a',
      items: [
        {
          icon: '👥',
          label: 'スタッフ一覧',
          href: '/dashboard/staff',
          description: 'スタッフの基本情報・時給・スキルレベルを管理。PINの設定・アカウント管理もここから。',
        },
        {
          icon: '📅',
          label: 'シフト管理',
          href: '/dashboard/shifts',
          description: 'スタッフのシフト希望を収集し、確定シフトを作成。LINEでスタッフ全員に一括通知できます。',
        },
        {
          icon: '🤖',
          label: 'AIシフト自動生成',
          href: '/dashboard/shifts/auto',
          description: 'スタッフの希望・制約条件を考慮してAIがシフト案を自動作成。工数を大幅に削減します。',
        },
        {
          icon: '💰',
          label: '給与計算',
          href: '/dashboard/payroll',
          description: '出勤記録・時給・深夜割増を元に月次給与を自動計算。振込額の確認・明細出力ができます。',
        },
        {
          icon: '⚔️',
          label: 'スタッフRPG',
          href: '/dashboard/rpg',
          description: 'スタッフの口コミ獲得・出勤・改善提案の実績を経験値（EXP）に変換し、レベル・ランクを可視化。モチベーション管理に活用できます。',
        },
        {
          icon: '📋',
          label: '改善申告',
          href: '/dashboard/improvements',
          description: 'スタッフから送られた改善提案を確認・承認・却下できます。承認するとスタッフにEXPが付与されます。',
          badge: pendingImprovements > 0 ? pendingImprovements : undefined,
        },
        {
          icon: '📖',
          label: 'スタッフマニュアル',
          href: '/dashboard/manual',
          description: '業務手順・ルール・システムの使い方をまとめたマニュアル。スタッフが確認できる状態に常に整備します。',
        },
      ],
    },
    {
      icon: '📣',
      title: '集客・マーケティング',
      color: '#f59e0b',
      bg: '#451a03',
      items: [
        {
          icon: '⭐',
          label: '口コミ管理',
          href: '/dashboard/reviews',
          description: 'スタッフが獲得した口コミを一覧表示。スクリーンショットの承認・クーポン発行・スタッフ別件数の確認ができます。',
        },
        {
          icon: '🎁',
          label: 'ロイヤルティ',
          href: '/dashboard/loyalty',
          description: 'リピート顧客向けのポイント・クーポン管理。来店回数に応じた特典設定で常連客の定着を促します。',
        },
        {
          icon: '📱',
          label: 'SNS投稿',
          href: '/dashboard/sns',
          description: 'TikTok・InstagramへのSNS投稿をAIがサポート。投稿文案の自動生成・スケジュール管理ができます。',
        },
        {
          icon: '🔮',
          label: '混雑予測',
          href: '/dashboard/forecast',
          description: '過去の売上データから混雑時間帯を予測。仕込み量・スタッフ配置の最適化に活用できます。',
        },
        {
          icon: '🧮',
          label: 'メニュー分析',
          href: '/dashboard/menu-engineering',
          description: '各メニューの売上・原価・利益率を分析。「看板メニュー」「要改善メニュー」を自動で分類します。',
        },
      ],
    },
    {
      icon: '🏪',
      title: '店舗運営',
      color: '#a855f7',
      bg: '#2e1065',
      items: [
        {
          icon: '🗃️',
          label: '在庫管理',
          href: '/dashboard/inventory',
          description: '食材・消耗品の在庫を記録・管理。発注タイミングの目安通知や在庫コストの把握に活用できます。',
        },
        {
          icon: '📦',
          label: '発注管理',
          href: '/dashboard/orders',
          description: '業者への発注をデジタルで記録。発注履歴・金額の管理で仕入れコストを最適化します。',
        },
      ],
    },
    {
      icon: '🔜',
      title: '今後開始予定',
      color: '#8b5cf6',
      bg: '#2d1b69',
      items: [
        {
          icon: '🍽️',
          label: 'メニュー管理',
          href: '/dashboard/menu-management',
          description: 'デジタルメニューの作成・編集・価格変更。QRコードメニューへの連携も対応予定。',
          status: 'coming',
        },
        {
          icon: '🪑',
          label: 'テーブル管理',
          href: '/dashboard/tables',
          description: '席の空き状況をリアルタイムで管理。フロアマップ・呼び出しベルとの連携機能を開発中。',
          status: 'coming',
        },
        {
          icon: '👨‍🍳',
          label: '厨房ディスプレイ',
          href: '/kitchen',
          description: '注文をリアルタイムで厨房に表示。キッチンとホールの連携をデジタル化します。',
          status: 'coming',
        },
        {
          icon: '🍜',
          label: 'モバイル注文',
          href: '/dashboard/menu-orders',
          description: 'お客様がスマホで注文できるQRオーダーシステム。ホールの省人化・回転率向上を目指します。',
          status: 'coming',
        },
      ],
    },
    {
      icon: '⚙️',
      title: '設定・管理',
      color: '#64748b',
      bg: '#0f172a',
      items: [
        {
          icon: '🛠️',
          label: '管理者ツール',
          href: '/dashboard/admin-tools',
          description: 'システム全体の設定・メンテナンス用ツール。テナント設定・データのリセット・バックアップなど。',
        },
        {
          icon: '⚙️',
          label: '設定',
          href: '/dashboard/settings',
          description: '店舗情報・月次目標・RPG報酬ロードマップなどの基本設定を管理します。',
        },
      ],
    },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0f1e', paddingBottom: '80px' }}>

      {/* ヘッダー */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '28px 20px 24px',
        borderBottom: '1px solid #1e293b',
      }}>
        <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          GOAT Restaurant OS
        </p>
        <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 800, margin: '0 0 6px' }}>
          🗺️ 機能マップ
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          利用できる全機能を一覧で確認できます
        </p>
      </div>

      {/* カテゴリ一覧 */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {CATEGORIES.map(cat => (
          <div key={cat.title}>

            {/* カテゴリヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '10px',
                background: cat.bg, border: `1px solid ${cat.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
              }}>
                {cat.icon}
              </div>
              <h2 style={{ color: '#f1f5f9', fontSize: '16px', fontWeight: 800, margin: 0 }}>
                {cat.title}
              </h2>
              <div style={{ flex: 1, height: 1, background: `${cat.color}22` }} />
            </div>

            {/* 機能カード グリッド（スマホ1列・PC2列） */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cat.items.map(item => (
                <a
                  key={item.href}
                  href={item.status === 'coming' ? undefined : item.href}
                  style={{
                    display: 'block',
                    background: '#1e293b',
                    border: `1px solid ${item.status === 'coming' ? '#1e293b' : '#334155'}`,
                    borderRadius: '14px',
                    padding: '16px',
                    textDecoration: 'none',
                    opacity: item.status === 'coming' ? 0.6 : 1,
                    cursor: item.status === 'coming' ? 'default' : 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {/* アイコン */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '12px',
                      background: cat.bg, border: `1px solid ${cat.color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', flexShrink: 0, position: 'relative',
                    }}>
                      {item.icon}
                      {/* バッジ */}
                      {item.badge && item.badge > 0 && (
                        <span style={{
                          position: 'absolute', top: -6, right: -6,
                          minWidth: 18, height: 18,
                          background: '#ef4444', color: 'white',
                          fontSize: '10px', fontWeight: 700,
                          borderRadius: '999px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px',
                        }}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>

                    {/* テキスト */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                        <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                          {item.label}
                        </p>
                        {item.status === 'coming' && (
                          <span style={{
                            background: '#4c1d95', color: '#c4b5fd',
                            fontSize: '10px', fontWeight: 700,
                            borderRadius: '999px', padding: '2px 8px',
                          }}>
                            準備中
                          </span>
                        )}
                        {item.badge && item.badge > 0 && (
                          <span style={{
                            background: '#7f1d1d', color: '#fca5a5',
                            fontSize: '11px', fontWeight: 700,
                            borderRadius: '999px', padding: '2px 10px',
                          }}>
                            {item.badge}件 未対応
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.65 }}>
                        {item.description}
                      </p>
                    </div>

                    {/* 矢印 */}
                    {item.status !== 'coming' && (
                      <span style={{ color: '#334155', fontSize: '18px', flexShrink: 0, marginTop: '10px' }}>›</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DashboardNav current="/dashboard/features" />
    </div>
  )
}
