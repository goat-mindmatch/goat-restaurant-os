'use client'

/**
 * 店舗改善申告 管理画面クライアント
 */

import DashboardNav from '@/components/DashboardNav'
import { useState } from 'react'

const CATEGORY_LABELS: Record<string, string> = {
  service:     '👥 接客',
  operation:   '⚙️ 運用',
  cleanliness: '🧹 清潔',
  menu:        '🍜 メニュー',
  other:       '💡 その他',
}

const EXP_OPTIONS = [
  { value: 100, label: '+100 EXP', desc: '小さな気づき' },
  { value: 200, label: '+200 EXP', desc: '具体的な改善案' },
  { value: 300, label: '+300 EXP', desc: '大きな貢献' },
]

type Improvement = {
  id: string
  staff_id: string | null
  staff_name: string | null
  category: string
  content: string
  status: 'pending' | 'approved' | 'rejected'
  exp_reward: number
  reviewer_note: string | null
  created_at: string
  reviewed_at: string | null
  staff?: { name: string } | null
}

export default function ImprovementsClient({
  improvements: initialData,
}: {
  improvements: Improvement[]
}) {
  const [items, setItems]       = useState<Improvement[]>(initialData)
  const [filter, setFilter]     = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [processing, setProcessing] = useState<string | null>(null)
  // 承認モーダル用
  const [modal, setModal]       = useState<{ id: string; staffName: string } | null>(null)
  const [expReward, setExpReward]   = useState(100)
  const [reviewerNote, setReviewerNote] = useState('')

  const filtered = items.filter(i => filter === 'all' ? true : i.status === filter)
  const pendingCount = items.filter(i => i.status === 'pending').length

  async function handleAction(id: string, action: 'approve' | 'reject', exp?: number, note?: string) {
    setProcessing(id)
    try {
      const res = await fetch(`/api/improvements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, exp_reward: exp, reviewer_note: note }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setItems(prev => prev.map(i =>
        i.id === id
          ? { ...i, status: action === 'approve' ? 'approved' : 'rejected', exp_reward: exp ?? 0, reviewer_note: note ?? null, reviewed_at: new Date().toISOString() }
          : i
      ))
      setModal(null)
      setReviewerNote('')
    } catch (e) {
      alert('エラーが発生しました: ' + (e instanceof Error ? e.message : ''))
    } finally {
      setProcessing(null)
    }
  }

  function formatDate(str: string) {
    const d = new Date(str)
    const mm = d.getMonth() + 1
    const dd = d.getDate()
    const hh = d.getHours().toString().padStart(2, '0')
    const mi = d.getMinutes().toString().padStart(2, '0')
    return `${mm}/${dd} ${hh}:${mi}`
  }

  function getSubmitterName(item: Improvement) {
    return item.staff?.name ?? item.staff_name ?? '匿名'
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0f172a' }}>
      <DashboardNav current="improvements" />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>💡</span>
            <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700, margin: 0 }}>
              改善申告
            </h1>
            {pendingCount > 0 && (
              <span style={{
                background: '#ef4444', color: 'white',
                borderRadius: '999px', padding: '2px 10px',
                fontSize: '13px', fontWeight: 700,
              }}>
                {pendingCount}件 未対応
              </span>
            )}
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            スタッフからの改善提案を承認してEXPを付与できます
          </p>
        </div>

        {/* フィルタータブ */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {([
            { key: 'pending',  label: '未対応', color: '#f59e0b' },
            { key: 'approved', label: '承認済み', color: '#10b981' },
            { key: 'rejected', label: '却下', color: '#6b7280' },
            { key: 'all',      label: 'すべて', color: '#3b82f6' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: filter === tab.key ? tab.color : '#1e293b',
                color: filter === tab.key ? 'white' : '#64748b',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {tab.label}
              <span style={{ marginLeft: '6px', fontSize: '12px', opacity: 0.8 }}>
                {items.filter(i => tab.key === 'all' ? true : i.status === tab.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* リスト */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
            <p>該当する申告はありません</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(item => (
              <div
                key={item.id}
                style={{
                  background: '#1e293b',
                  border: item.status === 'pending' ? '1px solid #f59e0b44' : '1px solid #334155',
                  borderRadius: '14px', padding: '20px',
                }}
              >
                {/* 上段: カテゴリ・名前・日時 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      background: '#334155', color: '#cbd5e1',
                      borderRadius: '6px', padding: '3px 10px', fontSize: '13px',
                    }}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                      {getSubmitterName(item)}
                    </span>
                    {!item.staff_id && (
                      <span style={{ color: '#475569', fontSize: '12px' }}>（匿名）</span>
                    )}
                  </div>
                  <span style={{ color: '#475569', fontSize: '12px' }}>
                    {formatDate(item.created_at)}
                  </span>
                </div>

                {/* 内容 */}
                <p style={{ color: '#e2e8f0', fontSize: '15px', lineHeight: 1.7, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>
                  {item.content}
                </p>

                {/* ステータス表示 */}
                {item.status !== 'pending' && (
                  <div style={{
                    background: item.status === 'approved' ? '#052e16' : '#1c1917',
                    border: `1px solid ${item.status === 'approved' ? '#166534' : '#44403c'}`,
                    borderRadius: '8px', padding: '10px 14px', marginBottom: '12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <span style={{ fontSize: '16px' }}>{item.status === 'approved' ? '✅' : '❌'}</span>
                    <div>
                      <div style={{ color: item.status === 'approved' ? '#86efac' : '#a8a29e', fontSize: '13px', fontWeight: 600 }}>
                        {item.status === 'approved' ? `承認済み (+${item.exp_reward} EXP)` : '却下済み'}
                        {item.reviewed_at && ` · ${formatDate(item.reviewed_at)}`}
                      </div>
                      {item.reviewer_note && (
                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                          コメント: {item.reviewer_note}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* アクションボタン（未対応のみ） */}
                {item.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setModal({ id: item.id, staffName: getSubmitterName(item) })
                        setExpReward(100)
                        setReviewerNote('')
                      }}
                      disabled={processing === item.id}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                        background: '#065f46', color: '#6ee7b7',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        minWidth: '120px',
                      }}
                    >
                      ✅ 承認してEXP付与
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={processing === item.id}
                      style={{
                        padding: '10px 20px', borderRadius: '10px', border: '1px solid #44403c',
                        background: 'transparent', color: '#78716c',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      却下
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 承認モーダル */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '16px',
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '20px', padding: '28px 24px',
            maxWidth: '400px', width: '100%',
          }}>
            <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>
              承認 · EXP付与
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>
              {modal.staffName} への付与EXPを選択してください
            </p>

            {/* EXP選択 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {EXP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => setExpReward(opt.value)}
                  style={{
                    padding: '14px 16px', borderRadius: '12px', border: 'none',
                    background: expReward === opt.value ? '#1d4ed8' : '#0f172a',
                    color: expReward === opt.value ? 'white' : '#94a3b8',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', fontWeight: expReward === opt.value ? 700 : 400,
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{opt.label}</span>
                  <span style={{ fontSize: '13px', opacity: 0.7 }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* コメント（任意） */}
            <textarea
              value={reviewerNote}
              onChange={e => setReviewerNote(e.target.value)}
              placeholder='スタッフへのコメント（任意）'
              rows={2}
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0f172a', border: '1px solid #334155',
                borderRadius: '10px', color: '#f1f5f9',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                resize: 'none', fontFamily: 'inherit', marginBottom: '16px',
              }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleAction(modal.id, 'approve', expReward, reviewerNote)}
                disabled={!!processing}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #065f46)',
                  color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {processing ? '処理中...' : `✅ ${expReward} EXP を付与`}
              </button>
              <button
                onClick={() => setModal(null)}
                style={{
                  padding: '14px 20px', borderRadius: '12px', border: '1px solid #334155',
                  background: 'transparent', color: '#64748b',
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
