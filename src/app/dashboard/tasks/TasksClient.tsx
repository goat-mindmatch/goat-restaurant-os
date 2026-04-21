'use client'

/**
 * 仕込みタスク クライアントコンポーネント
 * まぜそばマニュアルをベースに「開店前・営業中・閉店後」を完全再構成
 */

import { useState, useCallback } from 'react'
import DashboardNav from '@/components/DashboardNav'

type TaskLog = {
  id: string
  template_id: string | null
  date: string
  title: string
  timing: string
  completed_at: string | null
  note: string | null
  created_at: string
}

const TIMING_TABS = [
  { key: 'open',   label: '開店前',  emoji: '🌅', time: '9:30〜10:45', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'during', label: '営業中',  emoji: '⚡',  time: '営業時間中',  color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  { key: 'close',  label: '閉店後',  emoji: '🌙', time: '20:30〜22:00', color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
] as const

type Timing = 'open' | 'during' | 'close'

// ─── タスク追加モーダル ─────────────────────────────────
function AddTaskModal({
  onAdd,
  onClose,
  currentTiming,
}: {
  onAdd: (title: string, timing: string, templateOnly: boolean) => Promise<void>
  onClose: () => void
  currentTiming: Timing
}) {
  const [title, setTitle] = useState('')
  const [timing, setTiming] = useState<Timing>(currentTiming)
  const [templateOnly, setTemplateOnly] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    await onAdd(title.trim(), timing, templateOnly)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-12 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-4">タスクを追加</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">タスク名</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="例: キャベツの千切り（5kg）"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block">タイミング</label>
            <div className="grid grid-cols-3 gap-2">
              {TIMING_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTiming(tab.key)}
                  className="py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={timing === tab.key
                    ? { background: tab.color, color: 'white', borderColor: tab.color }
                    : { background: 'white', color: '#4B5563', borderColor: '#E5E7EB' }
                  }
                >
                  <span className="block">{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border border-gray-100 bg-gray-50">
            <input
              type="checkbox"
              checked={templateOnly}
              onChange={e => setTemplateOnly(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            <div>
              <p className="text-sm font-semibold text-gray-700">毎日のテンプレートにも追加</p>
              <p className="text-xs text-gray-400">ONにすると明日以降も表示されます</p>
            </div>
          </label>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
          >
            {loading ? '追加中...' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── タスク行 ──────────────────────────────────────────
function TaskRow({
  log,
  onToggle,
  onDelete,
  deleting,
  tabColor,
}: {
  log: TaskLog
  onToggle: (log: TaskLog) => void
  onDelete: (id: string, title: string) => void
  deleting: boolean
  tabColor: string
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 transition-all"
      style={log.completed_at ? { opacity: 0.55 } : {}}
    >
      {/* チェックボタン */}
      <button
        onClick={() => onToggle(log)}
        className="shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
        style={log.completed_at
          ? { background: '#22C55E', borderColor: '#22C55E' }
          : { borderColor: tabColor }
        }
      >
        {log.completed_at && <span className="text-white text-sm font-bold">✓</span>}
      </button>

      {/* タイトル */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${log.completed_at ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {log.title}
        </p>
        {log.completed_at && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(log.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 完了
          </p>
        )}
      </div>

      {/* 削除 */}
      <button
        onClick={() => onDelete(log.id, log.title)}
        disabled={deleting}
        className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors disabled:opacity-30 rounded-lg"
      >
        🗑
      </button>
    </div>
  )
}

// ─── メインコンポーネント ─────────────────────────────
export default function TasksClient({
  initialLogs,
  date,
}: {
  initialLogs: TaskLog[]
  date: string
}) {
  const [logs, setLogs]       = useState<TaskLog[]>(initialLogs)
  const [activeTab, setActiveTab] = useState<Timing>('open')
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // 全体進捗
  const totalCount = logs.length
  const doneCount  = logs.filter(l => l.completed_at).length
  const percent    = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // 現在タブ
  const filtered  = logs.filter(l => l.timing === activeTab)
  const tabConfig = TIMING_TABS.find(t => t.key === activeTab)!
  const tabDone   = filtered.filter(l => l.completed_at).length

  // チェック切り替え
  const handleToggle = useCallback(async (log: TaskLog) => {
    const completed = !log.completed_at
    const res = await fetch(`/api/tasks/${log.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    if (!res.ok) { showToast('更新に失敗しました'); return }
    const updated = await res.json()
    setLogs(prev => prev.map(l => l.id === log.id ? { ...l, completed_at: updated.completed_at } : l))
  }, [])

  // 削除
  const handleDelete = useCallback(async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return
    setDeletingId(id)
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!res.ok) { showToast('削除に失敗しました'); return }
    setLogs(prev => prev.filter(l => l.id !== id))
    showToast('タスクを削除しました')
  }, [])

  // テンプレートからリセット
  const handleReset = useCallback(async () => {
    if (!confirm('今日のタスクをテンプレートからリセットします。完了済みのチェックも全て消えます。よろしいですか？')) return
    setResetting(true)
    try {
      const res = await fetch(`/api/tasks?date=${date}&reset=true`, { method: 'DELETE' })
      if (!res.ok) { showToast('リセットに失敗しました'); return }
      const newLogs = await res.json()
      setLogs(Array.isArray(newLogs) ? newLogs : [])
      setActiveTab('open')
      showToast(`✅ ${Array.isArray(newLogs) ? newLogs.length : 0}件のタスクを読み込みました`)
    } catch {
      showToast('リセットに失敗しました')
    } finally {
      setResetting(false)
    }
  }, [date])

  // 追加
  const handleAdd = useCallback(async (title: string, timing: string, templateOnly: boolean) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, timing, template_only: templateOnly, date }),
    })
    if (!res.ok) { showToast('追加に失敗しました'); return }
    const data = await res.json()
    const log = data.log
    if (log) {
      setLogs(prev => [...prev, log])
      setActiveTab(timing as Timing)
    }
    showToast(templateOnly ? 'テンプレートとして追加しました' : 'タスクを追加しました')
  }, [date])

  const progressColor =
    percent >= 80 ? '#22C55E' :
    percent >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* タスク追加モーダル */}
      {showAdd && (
        <AddTaskModal
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
          currentTiming={activeTab}
        />
      )}

      {/* ─── ヘッダー ─── */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📋 仕込みタスク</h1>
            <p className="text-sm text-gray-500">{date}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="text-gray-400 text-sm font-bold px-3 py-2 rounded-xl border border-gray-200 bg-white active:scale-95 transition-transform disabled:opacity-40"
              title="テンプレートからリセット"
            >
              {resetting ? '⏳' : '🔄'}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform"
            >
              ＋ 追加
            </button>
          </div>
        </div>

        {/* 全体進捗バー */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xl font-black" style={{ color: progressColor }}>{percent}%</span>
            <span className="text-xs text-gray-400 font-medium">{doneCount}/{totalCount}件完了</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%`, background: progressColor }}
            />
          </div>
          {percent === 100 && (
            <p className="text-center text-xs font-bold text-green-600 mt-1">🎉 全タスク完了！お疲れ様でした</p>
          )}
        </div>

        {/* タブ切替 */}
        <div className="grid grid-cols-3 gap-2">
          {TIMING_TABS.map(tab => {
            const tabLogs    = logs.filter(l => l.timing === tab.key)
            const tabDoneNum = tabLogs.filter(l => l.completed_at).length
            const isActive   = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                style={isActive
                  ? { background: tab.color, borderColor: tab.color, color: 'white' }
                  : { background: 'white', borderColor: '#E5E7EB', color: '#6B7280' }
                }
              >
                <span className="block text-base leading-tight">{tab.emoji}</span>
                <span className="text-xs">{tab.label}</span>
                <span className="block text-[10px] mt-0.5" style={isActive ? { opacity: 0.8 } : { color: '#9CA3AF' }}>
                  {tabDoneNum}/{tabLogs.length}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── タスクリスト ─── */}
      <div className="px-4 pt-4 space-y-2">

        {/* 現在タブ情報バナー */}
        <div
          className="rounded-xl px-4 py-2.5 flex items-center justify-between mb-2"
          style={{ background: tabConfig.bg, border: `1.5px solid ${tabConfig.border}` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{tabConfig.emoji}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: tabConfig.color }}>{tabConfig.label}</p>
              <p className="text-xs text-gray-500">⏰ {tabConfig.time}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black" style={{ color: tabConfig.color }}>{tabDone}/{filtered.length}</p>
            <p className="text-[10px] text-gray-400">完了</p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-gray-500 font-medium text-sm">タスクがありません</p>
            <p className="text-xs text-gray-400 mt-1">「＋ 追加」から追加してください</p>
          </div>
        ) : (
          filtered.map(log => (
            <TaskRow
              key={log.id}
              log={log}
              onToggle={handleToggle}
              onDelete={handleDelete}
              deleting={deletingId === log.id}
              tabColor={tabConfig.color}
            />
          ))
        )}
      </div>

      <DashboardNav current="/dashboard/tasks" />
    </div>
  )
}
