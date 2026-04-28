'use client'

/**
 * 店舗改善申告フォーム（スタッフ向け・スマホ最適化）
 */

import { useState } from 'react'

const CATEGORIES = [
  { value: 'service',     label: '👥 接客・サービス' },
  { value: 'operation',   label: '⚙️ オペレーション' },
  { value: 'cleanliness', label: '🧹 清潔・衛生' },
  { value: 'menu',        label: '🍜 メニュー・味' },
  { value: 'other',       label: '💡 その他' },
]

type Stage = 'form' | 'done'

export default function ImprovementForm({
  staffList,
}: {
  staffList: { id: string; name: string }[]
}) {
  const [stage, setStage] = useState<Stage>('form')
  const [staffId, setStaffId]   = useState<string>('')   // '' = 匿名
  const [category, setCategory] = useState<string>('other')
  const [content, setContent]   = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setError('内容を入力してください'); return }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id:  staffId || undefined,
          category,
          content: content.trim(),
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '送信に失敗しました')
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 送信完了画面 ─────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#1e293b', borderRadius: '20px', padding: '40px 32px', textAlign: 'center', maxWidth: '380px', width: '100%' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
            送信しました！
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px' }}>
            ご意見ありがとうございます。<br />
            管理者が確認後、承認されるとEXPが付与されます。
          </p>
          <button
            onClick={() => { setStage('form'); setContent(''); setStaffId(''); setCategory('other') }}
            style={{
              background: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '12px', padding: '14px 28px',
              fontSize: '16px', fontWeight: 600, cursor: 'pointer', width: '100%',
            }}
          >
            もう一件送る
          </button>
        </div>
      </div>
    )
  }

  // ── フォーム ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', padding: '24px 16px' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💡</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>
            店舗改善 意見箱
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            気づいたこと・改善提案を気軽に送ってください
          </p>
        </div>

        <form onSubmit={handleSubmit}>

          {/* 名前（任意） */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              あなたの名前（任意）
            </label>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px',
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '12px', color: '#f1f5f9',
                fontSize: '16px', outline: 'none', boxSizing: 'border-box',
                appearance: 'none',
              }}
            >
              <option value=''>匿名で送る</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {staffId && (
              <p style={{ color: '#3b82f6', fontSize: '12px', margin: '6px 0 0' }}>
                ⭐ 承認されると EXP が付与されます
              </p>
            )}
          </div>

          {/* カテゴリ */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              カテゴリ
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type='button'
                  onClick={() => setCategory(c.value)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: category === c.value ? '2px solid #3b82f6' : '2px solid #334155',
                    background: category === c.value ? '#1d4ed8' : '#1e293b',
                    color: category === c.value ? 'white' : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: category === c.value ? 700 : 400,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 内容 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              内容 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder='気づいたこと、改善アイデア、要望などを自由に書いてください。どんな小さなことでも大歓迎です！'
              rows={5}
              style={{
                width: '100%', padding: '14px 16px',
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '12px', color: '#f1f5f9',
                fontSize: '16px', outline: 'none', boxSizing: 'border-box',
                resize: 'vertical', lineHeight: 1.6,
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = '#334155' }}
            />
            <div style={{ textAlign: 'right', color: '#475569', fontSize: '12px', marginTop: '4px' }}>
              {content.length} 文字
            </div>
          </div>

          {/* エラー */}
          {error && (
            <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#fca5a5', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* 送信ボタン */}
          <button
            type='submit'
            disabled={submitting || !content.trim()}
            style={{
              width: '100%', padding: '16px',
              background: submitting || !content.trim() ? '#1e293b' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: submitting || !content.trim() ? '#475569' : 'white',
              border: 'none', borderRadius: '14px',
              fontSize: '17px', fontWeight: 700,
              cursor: submitting || !content.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? '送信中...' : '📨 送信する'}
          </button>

          <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
            匿名でも送れます。内容は管理者のみ確認できます。
          </p>
        </form>
      </div>
    </div>
  )
}
