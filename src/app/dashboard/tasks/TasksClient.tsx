'use client'

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
  { key: 'open',   label: '開店前', emoji: '🌅' },
  { key: 'during', label: '営業中', emoji: '⚡' },
  { key: 'close',  label: '閉店後', emoji: '🌙' },
] as const

type Timing = 'open' | 'during' | 'close'

/* ─── タスク追加モーダル ─── */
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 pb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4">タスクを追加</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">タスク名</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="例: キャベツの千切り（5kg）"
              className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">タイミング</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {TIMING_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTiming(tab.key)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    timing === tab.key
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {tab.emoji} {tab.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={templateOnly}
              onChange={e => setTemplateOnly(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-sm text-gray-700">毎日のテンプレートにも追加する</span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-gray-600 text-sm font-semibold"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-40"
          >
            {loading ? '追加中...' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── メインコンポーネント ─── */
export default function TasksClient({
  initialLogs,
  date,
}: {
  initialLogs: TaskLog[]
  date: string
}) {
  const [logs, setLogs] = useState<TaskLog[]>(initialLogs)
  const [activeTab, setActiveTab] = useState<Timing>('open')
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // 完了率
  const totalCount = logs.length
  const doneCount = logs.filter(l => l.completed_at).length
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // タブフィルタ
  const filtered = logs.filter(l => l.timing === activeTab)
  const tabDone = filtered.filter(l => l.completed_at).length

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

  // タスク追加
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

  const progressColor = percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-orange-400' : 'bg-red-400'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg whitespace-nowrap">
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

      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📋 仕込みタスク</h1>
            <p className="text-sm text-gray-500">{date}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform"
          >
            ＋ タスク追加
          </button>
        </div>

        {/* 完了率 */}
        <div className="mb-3">
          <div className="flex items-end justify-between mb-1">
            <span className="text-3xl font-black text-gray-900">{percent}%</span>
            <span className="text-sm text-gray-500 font-medium">{doneCount}/{totalCount}件完了</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* タブ */}
        <div className="grid grid-cols-3 gap-2">
          {TIMING_TABS.map(tab => {
            const tabLogs = logs.filter(l => l.timing === tab.key)
            const tabDoneCount = tabLogs.filter(l => l.completed_at).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  activeTab === tab.key
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <span className="block">{tab.emoji} {tab.label}</span>
                <span className={`text-xs font-normal ${activeTab === tab.key ? 'text-orange-100' : 'text-gray-400'}`}>
                  {tabDoneCount}/{tabLogs.length}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* タスクリスト */}
      <div className="px-4 pt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-gray-500 font-medium">タスクがありません</p>
            <p className="text-sm text-gray-400 mt-1">「＋ タスク追加」から追加してください</p>
          </div>
        ) : (
          filtered.map(log => (
            <div
              key={log.id}
              className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 transition-opacity ${
                log.completed_at ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {/* チェックボックス */}
              <button
                onClick={() => handleToggle(log)}
                className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                  log.completed_at
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300'
                }`}
              >
                {log.completed_at && <span className="text-sm font-bold">✓</span>}
              </button>

              {/* タイトル */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold text-gray-800 ${log.completed_at ? 'line-through text-gray-400' : ''}`}>
                  {log.title}
                </p>
                {log.completed_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 完了
                  </p>
                )}
              </div>

              {/* 削除ボタン */}
              <button
                onClick={() => handleDelete(log.id, log.title)}
                disabled={deletingId === log.id}
                className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-lg px-1 disabled:opacity-30"
                title="削除"
              >
                🗑
              </button>
            </div>
          ))
        )}

        {/* タブ内完了数 */}
        {filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 pt-2 pb-4">
            {TIMING_TABS.find(t => t.key === activeTab)?.label}：{tabDone}/{filtered.length}件完了
          </p>
        )}
      </div>

      <DashboardNav current="/dashboard/tasks" />
    </div>
  )
}
