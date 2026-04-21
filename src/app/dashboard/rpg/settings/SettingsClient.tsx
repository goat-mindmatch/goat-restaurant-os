'use client'

/**
 * RPG報酬設定 クライアントコンポーネント
 * - 各レベルの報酬内容（アイコン・タイトル・説明・色）を編集
 * - 保存ボタンで /api/rpg/rewards にPOST
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardNav from '@/components/DashboardNav'
import type { RPGReward } from '@/app/api/rpg/rewards/route'

// 選択できる色のプリセット
const COLOR_PRESETS = [
  { label: '緑',    value: '#34D399' },
  { label: '青',    value: '#60A5FA' },
  { label: '黄',    value: '#F59E0B' },
  { label: '紫',    value: '#A855F7' },
  { label: '金',    value: '#FFD700' },
  { label: '赤',    value: '#F87171' },
  { label: 'ピンク', value: '#F472B6' },
  { label: '白',    value: '#E5E7EB' },
]

// よく使う絵文字のプリセット
const ICON_PRESETS = [
  '🎯','🍜','🎌','💰','👑','🎁','⭐','🏆',
  '🎉','🔥','💎','🚀','🌟','🍺','🎖️','🥇',
  '🎪','🏅','💫','🎊','🍣','☕','🎸','🌈',
]

type Props = {
  initialRewards: RPGReward[]
}

export default function RPGSettingsClient({ initialRewards }: Props) {
  const router = useRouter()
  const [rewards, setRewards] = useState<RPGReward[]>(initialRewards)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [openPicker, setOpenPicker] = useState<{ index: number; type: 'icon' | 'color' } | null>(null)
  const [addingLevel, setAddingLevel] = useState(false)
  const [newLevel, setNewLevel] = useState('')

  // フィールド更新
  const update = (index: number, field: keyof RPGReward, value: string | number) => {
    setRewards(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  // 並び順を常にlevel昇順に保つ
  const sorted = [...rewards].sort((a, b) => a.level - b.level)

  // 保存
  const handleSave = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/rpg/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewards: sorted }),
      })
      const json = await res.json()
      if (json.ok) {
        setMsg({ type: 'ok', text: '✅ 保存しました！RPGページに反映されました。' })
        setTimeout(() => setMsg(null), 4000)
      } else if (json.code === 'COLUMN_MISSING') {
        setMsg({ type: 'error', text: '⚠️ Supabase設定が必要です。下の手順を確認してください。' })
      } else {
        setMsg({ type: 'error', text: `⚠️ ${json.error ?? '保存に失敗しました'}` })
      }
    } catch {
      setMsg({ type: 'error', text: '⚠️ 通信エラーが発生しました' })
    }
    setSaving(false)
  }

  // 報酬を追加
  const handleAddReward = () => {
    const lv = parseInt(newLevel)
    if (!lv || lv < 1 || lv > 100) return
    if (rewards.some(r => r.level === lv)) {
      setMsg({ type: 'error', text: `Lv${lv} はすでに存在します` })
      setTimeout(() => setMsg(null), 2000)
      return
    }
    setRewards(prev => [...prev, {
      level: lv, icon: '🎁', title: '新しい報酬', desc: '内容を入力してください', color: '#34D399'
    }])
    setNewLevel('')
    setAddingLevel(false)
  }

  // 報酬を削除
  const handleDelete = (index: number) => {
    setRewards(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#060818' }}>
      {/* ヘッダー */}
      <div
        className="px-4 pt-12 pb-4 sticky top-0 z-10"
        style={{
          background: 'linear-gradient(180deg, #0f0535 0%, #060818 100%)',
          borderBottom: '1px solid rgba(168,85,247,0.3)',
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="text-purple-400 text-sm font-semibold"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-black text-white flex-1">🎁 報酬ロードマップ設定</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-black px-4 py-2 rounded-xl disabled:opacity-50 transition-all"
            style={{ background: '#A855F7', color: 'white' }}
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          各レベルで達成したスタッフへの特典を自由に設定できます
        </p>

        {/* 保存メッセージ */}
        {msg && (
          <div
            className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              background: msg.type === 'ok' ? '#052e16' : '#450a0a',
              color: msg.type === 'ok' ? '#86efac' : '#fca5a5',
              border: `1px solid ${msg.type === 'ok' ? '#16a34a' : '#b91c1c'}`,
            }}
          >
            {msg.text}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {/* 報酬リスト */}
        <div className="flex flex-col gap-3">
          {sorted.map((reward, idx) => {
            const originalIdx = rewards.findIndex(r => r.level === reward.level)
            return (
              <div
                key={reward.level}
                className="rounded-2xl overflow-hidden"
                style={{ border: `1.5px solid ${reward.color}55` }}
              >
                {/* カードヘッダー */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ background: `${reward.color}18` }}
                >
                  <div className="flex items-center gap-2">
                    {/* アイコン選択ボタン */}
                    <button
                      onClick={() => setOpenPicker(
                        openPicker?.index === originalIdx && openPicker.type === 'icon'
                          ? null
                          : { index: originalIdx, type: 'icon' }
                      )}
                      className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                      style={{ background: `${reward.color}22`, border: `1px solid ${reward.color}44` }}
                    >
                      {reward.icon}
                    </button>
                    <div>
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: `${reward.color}33`, color: reward.color }}
                      >
                        Lv {reward.level}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 色選択ボタン */}
                    <button
                      onClick={() => setOpenPicker(
                        openPicker?.index === originalIdx && openPicker.type === 'color'
                          ? null
                          : { index: originalIdx, type: 'color' }
                      )}
                      className="w-6 h-6 rounded-full border-2 border-white border-opacity-30 transition-all hover:scale-110"
                      style={{ background: reward.color }}
                    />
                    {/* 削除ボタン */}
                    <button
                      onClick={() => handleDelete(originalIdx)}
                      className="text-gray-600 hover:text-red-400 text-sm font-bold px-2 py-1 rounded-lg transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>

                {/* アイコンピッカー */}
                {openPicker?.index === originalIdx && openPicker.type === 'icon' && (
                  <div className="px-3 py-3" style={{ background: '#0d0d2a', borderBottom: `1px solid ${reward.color}33` }}>
                    <p className="text-[10px] text-gray-500 mb-2">アイコンを選択</p>
                    <div className="grid grid-cols-8 gap-1.5">
                      {ICON_PRESETS.map(em => (
                        <button
                          key={em}
                          onClick={() => { update(originalIdx, 'icon', em); setOpenPicker(null) }}
                          className="text-xl w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            background: reward.icon === em ? `${reward.color}33` : 'rgba(255,255,255,0.05)',
                            border: reward.icon === em ? `1px solid ${reward.color}` : '1px solid transparent',
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="直接入力（例: 🎪）"
                        maxLength={4}
                        className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                        onChange={e => { if (e.target.value) update(originalIdx, 'icon', e.target.value) }}
                      />
                      <button
                        onClick={() => setOpenPicker(null)}
                        className="text-xs text-gray-400 px-3 py-1.5"
                      >
                        閉じる
                      </button>
                    </div>
                  </div>
                )}

                {/* 色ピッカー */}
                {openPicker?.index === originalIdx && openPicker.type === 'color' && (
                  <div className="px-3 py-3" style={{ background: '#0d0d2a', borderBottom: `1px solid ${reward.color}33` }}>
                    <p className="text-[10px] text-gray-500 mb-2">カードの色を選択</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => { update(originalIdx, 'color', c.value); setOpenPicker(null) }}
                          className="flex flex-col items-center gap-1"
                        >
                          <div
                            className="w-8 h-8 rounded-full transition-all hover:scale-110"
                            style={{
                              background: c.value,
                              border: reward.color === c.value ? '3px solid white' : '2px solid rgba(255,255,255,0.2)',
                            }}
                          />
                          <span className="text-[9px] text-gray-500">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 編集フォーム */}
                <div className="px-4 py-3 space-y-2" style={{ background: '#0d0d1a' }}>
                  {/* タイトル */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">特典タイトル</label>
                    <input
                      type="text"
                      value={reward.title}
                      onChange={e => update(originalIdx, 'title', e.target.value)}
                      placeholder="例: 好きなシフト優先権"
                      className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${reward.color}33`,
                      }}
                    />
                  </div>
                  {/* 説明 */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">説明文（スタッフに見える）</label>
                    <textarea
                      value={reward.desc}
                      onChange={e => update(originalIdx, 'desc', e.target.value)}
                      placeholder="例: 1日分のシフト希望が100%通る"
                      rows={2}
                      className="w-full rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none resize-none"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${reward.color}22`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 報酬を追加 */}
        <div className="mt-4">
          {!addingLevel ? (
            <button
              onClick={() => setAddingLevel(true)}
              className="w-full py-4 rounded-2xl text-sm font-bold text-gray-400 transition-all hover:text-white"
              style={{ border: '1.5px dashed rgba(255,255,255,0.15)', background: 'transparent' }}
            >
              ＋ 新しいレベル報酬を追加
            </button>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1.5px dashed #A855F7' }}
            >
              <p className="text-xs text-purple-300 mb-2 font-semibold">どのレベルに報酬を追加しますか？</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newLevel}
                  onChange={e => setNewLevel(e.target.value)}
                  placeholder="例: 8"
                  min={1} max={100}
                  className="flex-1 rounded-xl px-3 py-2 text-sm text-white font-bold text-center focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid #A855F7' }}
                />
                <button
                  onClick={handleAddReward}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#A855F7' }}
                >
                  追加
                </button>
                <button
                  onClick={() => { setAddingLevel(false); setNewLevel('') }}
                  className="px-3 py-2 rounded-xl text-sm text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Supabase設定案内 */}
        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-bold text-gray-400 mb-2">⚙️ 初回設定：Supabase SQLを1回実行</p>
          <p className="text-[11px] text-gray-500 mb-2">
            初めて保存するとき、Supabase Dashboard → SQL Editor で以下を実行してください：
          </p>
          <div
            className="rounded-xl px-3 py-2 font-mono text-xs text-green-400 select-all"
            style={{ background: '#0a1a0a', border: '1px solid #166534' }}
          >
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rpg_rewards JSONB;
          </div>
          <p className="text-[10px] text-gray-600 mt-2">※ 1回実行すれば以降は不要です</p>
        </div>

        <div className="h-6" />
      </div>

      <DashboardNav current="/dashboard/rpg" />
    </div>
  )
}
