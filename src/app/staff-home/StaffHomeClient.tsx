'use client'

/**
 * スタッフ専用ホーム — UI
 * スマホ最適化・ダークテーマ・カードベース
 */

import { useState, useEffect } from 'react'

type ShiftRow = {
  staff_id: string
  start_time: string
  end_time: string
  role_on_day: string | null
  staff: { name: string } | null
}

type RankingRow = {
  id: string
  name: string
  exp: number
  level: number
  workDays: number
  reviews: number
}

function formatTime(t: string) {
  return t?.slice(0, 5) ?? '--:--'
}

function getLevelClass(level: number) {
  if (level >= 25) return { label: '之神',  color: '#FFD700', bg: '#3d2c00' }
  if (level >= 18) return { label: '伝説',  color: '#A855F7', bg: '#2e1065' }
  if (level >= 12) return { label: '賢者',  color: '#60A5FA', bg: '#1e3a5f' }
  if (level >= 7)  return { label: '武闘家', color: '#F87171', bg: '#450a0a' }
  if (level >= 3)  return { label: '僧侶',  color: '#34D399', bg: '#064e3b' }
  return                  { label: '旅人',  color: '#9CA3AF', bg: '#1f2937' }
}

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

export default function StaffHomeClient({
  staffName,
  todayShifts,
  rankings,
  pendingImprovements,
  today,
  currentMonth,
}: {
  staffName: string | null
  todayShifts: ShiftRow[]
  rankings: RankingRow[]
  pendingImprovements: number
  today: string
  currentMonth: string
}) {
  const [currentTime, setCurrentTime] = useState('')

  // 現在時刻を1分ごとに更新
  useEffect(() => {
    function tick() {
      const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const h = String(jst.getUTCHours()).padStart(2, '0')
      const m = String(jst.getUTCMinutes()).padStart(2, '0')
      setCurrentTime(`${h}:${m}`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const [y, mo, d] = today.split('-')
  const dateLabel = `${Number(mo)}月${Number(d)}日`

  const greeting = (() => {
    const h = Number(currentTime.split(':')[0])
    if (h < 10) return 'おはようございます'
    if (h < 17) return 'お疲れ様です'
    return 'お疲れ様です'
  })()

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0f1e', paddingBottom: '32px' }}>

      {/* ━━━ ヘッダー ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
        padding: '28px 20px 24px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 装飾円 */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(59,130,246,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(139,92,246,0.12)' }} />

        <div style={{ position: 'relative' }}>
          <p style={{ color: '#93c5fd', fontSize: '13px', margin: '0 0 4px', fontWeight: 500 }}>
            {dateLabel}（{currentTime}）
          </p>
          <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: 800, margin: '0 0 4px', lineHeight: 1.3 }}>
            {staffName ? `${staffName}さん、` : ''}
            {greeting}！
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            🍜 人類みなまぜそば スタッフ画面
          </p>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ━━━ 🕐 今日の勤務 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section icon="🕐" title="今日の勤務" color="#3b82f6">

          {/* 打刻カード */}
          <Card
            icon="📲"
            iconBg="#1e3a8a"
            title="出勤・退勤の打刻"
            description="LINEに「出勤」「退勤」と送ると自動で記録されます。シフト開始時刻より早く来るほど経験値（EXP）がアップします！"
            badge={null}
          >
            <a
              href="https://line.me/R/"
              style={btnStyle('#3b82f6')}
              target="_blank"
              rel="noopener noreferrer"
            >
              LINEアプリを開く →
            </a>
          </Card>

          {/* 今日のシフト */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>📅</span>
              <div>
                <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>本日の出勤予定</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>誰が何時から働くかを確認できます</p>
              </div>
            </div>
            {todayShifts.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px', textAlign: 'center', padding: '12px 0', margin: 0 }}>
                本日の確定シフトはありません
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todayShifts.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: '#0f172a', borderRadius: '10px', padding: '10px 14px',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color: '#93c5fd', flexShrink: 0,
                    }}>
                      {(s.staff?.name ?? '?')[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                        {s.staff?.name ?? '不明'}
                      </p>
                      {s.role_on_day && (
                        <p style={{ color: '#64748b', fontSize: '11px', margin: '1px 0 0' }}>{s.role_on_day}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: '#93c5fd', fontSize: '13px', fontWeight: 600, margin: 0 }}>
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ━━━ ⚔️ 今月のランキング ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section icon="⚔️" title={`${currentMonth}ランキング`} color="#a855f7">
          <div style={cardStyle}>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 14px' }}>
              口コミ獲得・出勤・改善提案などで経験値（EXP）を貯めてレベルアップ！
            </p>
            {rankings.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px', textAlign: 'center', padding: '12px 0', margin: 0 }}>今月のデータはまだありません</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rankings.map((r, i) => {
                  const cls = getLevelClass(r.level)
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: i === 0 ? '#1c1400' : '#0f172a',
                      border: i === 0 ? '1px solid #854d0e' : '1px solid #1e293b',
                      borderRadius: '12px', padding: '10px 14px',
                    }}>
                      <span style={{ fontSize: '20px', width: 28, textAlign: 'center' }}>{RANK_MEDALS[i]}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 700, margin: 0 }}>{r.name}</p>
                        <p style={{ color: '#64748b', fontSize: '11px', margin: '2px 0 0' }}>
                          出勤 {r.workDays}日 / 口コミ {r.reviews}件
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 700, margin: 0 }}>
                          {r.exp.toLocaleString()} EXP
                        </p>
                        <span style={{
                          background: cls.bg, color: cls.color,
                          fontSize: '10px', fontWeight: 700,
                          borderRadius: '999px', padding: '2px 8px',
                          display: 'inline-block', marginTop: '2px',
                        }}>
                          Lv.{r.level} {cls.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <a href="/dashboard/rpg" style={{ ...btnStyle('#7c3aed'), display: 'block', textAlign: 'center', marginTop: '14px' }}>
              全員のランクを見る →
            </a>
          </div>
        </Section>

        {/* ━━━ 💡 お店をよくする ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section icon="💡" title="お店をもっとよくする" color="#f59e0b">

          <Card
            icon="📝"
            iconBg="#451a03"
            title="改善提案を送る"
            description="「こうしたらよくなる！」と思ったことを気軽に送ってください。小さな気づきでも大歓迎。匿名でもOKで、管理者に承認されると経験値（EXP）がもらえます！"
            badge={null}
          >
            <a href="/improve" style={btnStyle('#f59e0b', '#1c1400', '#92400e')}>
              💡 意見・提案を送る →
            </a>
          </Card>

          <Card
            icon="⭐"
            iconBg="#1c1400"
            title="口コミのお願い"
            description="来店されたお客様にGoogleや食べログへの口コミをお願いするためのフォームです。口コミ1件につき150 EXPが付与されます。"
            badge={null}
          >
            <a href="/review" style={btnStyle('#ea580c', '#1c0a00', '#7c2d12')}>
              ⭐ 口コミフォームを開く →
            </a>
          </Card>
        </Section>

        {/* ━━━ 📖 情報・マニュアル ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section icon="📖" title="情報・マニュアル" color="#10b981">

          <Card
            icon="📗"
            iconBg="#064e3b"
            title="スタッフマニュアル"
            description="業務の手順・ルール・LINEシステムの使い方・ポイント制度の詳細をまとめています。新しい業務を覚えるときはここをチェック！"
            badge={null}
          >
            <a href="/dashboard/manual" style={btnStyle('#10b981', '#052e16', '#065f46')}>
              📗 マニュアルを開く →
            </a>
          </Card>

          <Card
            icon="📅"
            iconBg="#0c4a6e"
            title="シフト希望を出す"
            description="来月のシフト希望はLINEから送ることができます。「シフト希望提出」と送ると入力フォームが届きます。"
            badge={null}
          >
            <a
              href="https://line.me/R/"
              style={btnStyle('#0ea5e9', '#082f49', '#0c4a6e')}
              target="_blank"
              rel="noopener noreferrer"
            >
              📅 LINEでシフト希望を出す →
            </a>
          </Card>
        </Section>

      </div>
    </div>
  )
}

/* ── 部品コンポーネント ─────────────────────────────────── */

function Section({ icon, title, color, children }: {
  icon: string
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <h2 style={{
          color: '#f1f5f9', fontSize: '16px', fontWeight: 800,
          margin: 0, letterSpacing: '0.02em',
        }}>
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, background: `${color}33`, marginLeft: '4px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {children}
      </div>
    </div>
  )
}

function Card({ icon, iconBg, title, description, badge, children }: {
  icon: string
  iconBg: string
  title: string
  description: string
  badge: { text: string; color: string } | null
  children?: React.ReactNode
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: children ? '14px' : 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '12px',
          background: iconBg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '22px', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 700, margin: 0 }}>{title}</p>
            {badge && (
              <span style={{
                background: badge.color, color: 'white',
                fontSize: '10px', fontWeight: 700,
                borderRadius: '999px', padding: '2px 8px',
              }}>
                {badge.text}
              </span>
            )}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '16px',
  padding: '16px',
  border: '1px solid #334155',
}

function btnStyle(accent: string, bg?: string, border?: string): React.CSSProperties {
  return {
    display: 'block',
    padding: '13px 16px',
    background: bg ?? accent,
    border: `1px solid ${border ?? accent}`,
    borderRadius: '12px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center',
  }
}
