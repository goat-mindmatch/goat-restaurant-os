'use client'

/**
 * SNS投稿管理 クライアントコンポーネント
 * - 投稿一覧（タブ: draft / scheduled / posted / failed）
 * - 新規投稿モーダル（AIキャプション生成）
 */

import { useEffect, useState } from 'react'

type SnsPost = {
  id: string
  menu_name: string | null
  photo_url: string | null
  caption: string
  hashtags: string[]
  platforms: string[]
  scheduled_at: string | null
  status: 'draft' | 'scheduled' | 'posted' | 'failed'
  created_at: string
}

type Tab = 'scheduled' | 'draft' | 'posted' | 'failed'

const TAB_CONFIG: Record<Tab, { label: string; icon: string; color: string }> = {
  scheduled: { label: '予約済み', icon: '⏰', color: 'text-blue-600' },
  draft:     { label: '下書き',   icon: '📝', color: 'text-gray-600' },
  posted:    { label: '投稿済み', icon: '✅', color: 'text-green-600' },
  failed:    { label: '失敗',     icon: '❌', color: 'text-red-600' },
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok',   label: 'TikTok',    icon: '🎵' },
  { id: 'x',        label: 'X',         icon: '🐦' },
]

const TABS: Tab[] = ['scheduled', 'draft', 'posted', 'failed']

export default function SNSClient() {
  const [posts, setPosts] = useState<SnsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('scheduled')
  const [showModal, setShowModal] = useState(false)

  // フォーム
  const [menuName, setMenuName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram'])
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    setLoading(true)
    try {
      const res = await fetch('/api/sns/posts')
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateCaption() {
    if (!menuName.trim()) {
      setCaptionError('メニュー名を入力してください')
      return
    }
    setCaptionLoading(true)
    setCaptionError(null)
    try {
      const res = await fetch('/api/sns/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_name: menuName, description, price: price ? Number(price) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCaption(data.caption ?? '')
      setHashtags(data.hashtags ?? [])
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setCaptionLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/sns/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_name: menuName || null,
          photo_url: photoUrl || null,
          caption,
          hashtags,
          platforms: selectedPlatforms,
          scheduled_at: scheduleMode === 'schedule' && scheduledAt ? scheduledAt : null,
          status: 'scheduled',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await fetchPosts()
      setShowModal(false)
      resetForm()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setMenuName('')
    setDescription('')
    setPrice('')
    setPhotoUrl('')
    setCaption('')
    setHashtags([])
    setSelectedPlatforms(['instagram'])
    setScheduleMode('now')
    setScheduledAt('')
    setCaptionError(null)
    setSaveError(null)
  }

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const filteredPosts = posts.filter(p => p.status === activeTab)

  return (
    <div className="space-y-4">
      {/* ヘッダーアクション */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow hover:bg-orange-600 transition"
        >
          <span className="text-base">＋</span>
          新規投稿を作成
        </button>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => {
            const cfg = TAB_CONFIG[tab]
            const count = posts.filter(p => p.status === tab).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                  activeTab === tab ? `border-b-2 border-orange-500 ${cfg.color}` : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {cfg.icon} {cfg.label}
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8 text-sm">読み込み中...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">投稿がありません</div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <div key={post.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      {post.menu_name && (
                        <p className="text-xs font-semibold text-gray-500 mb-0.5">{post.menu_name}</p>
                      )}
                      <p className="text-sm text-gray-800 leading-snug">{post.caption}</p>
                    </div>
                    {post.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover ml-2 flex-shrink-0" />
                    )}
                  </div>
                  {post.hashtags.length > 0 && (
                    <p className="text-xs text-blue-500 mt-1">{post.hashtags.map(h => `#${h}`).join(' ')}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {post.platforms.map(p => {
                      const plt = PLATFORMS.find(pl => pl.id === p)
                      return plt ? (
                        <span key={p} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
                          {plt.icon} {plt.label}
                        </span>
                      ) : null
                    })}
                    {post.scheduled_at && (
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(post.scheduled_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 新規投稿モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-800 mb-4">新規投稿を作成</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">メニュー名 *</label>
                <input
                  type="text"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  placeholder="例: 特製まぜそば"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">メニュー説明（任意）</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="例: にんにくが効いた濃厚タレ"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">価格（円）（任意）</label>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="例: 980"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">写真URL（任意）</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              {/* AIキャプション生成 */}
              <button
                onClick={handleGenerateCaption}
                disabled={captionLoading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {captionLoading ? <span className="animate-spin">⏳</span> : <span>🤖</span>}
                AIキャプション生成
              </button>
              {captionError && <p className="text-xs text-red-600">{captionError}</p>}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">キャプション</label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={3}
                  placeholder="AIが生成、または手動入力"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>

              {hashtags.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ハッシュタグ</label>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((h, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5">
                        #{h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">プラットフォーム</label>
                <div className="flex gap-3">
                  {PLATFORMS.map(p => (
                    <label key={p.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(p.id)}
                        onChange={() => togglePlatform(p.id)}
                        className="w-4 h-4 rounded accent-orange-500"
                      />
                      <span className="text-sm text-gray-700">{p.icon} {p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">投稿タイミング</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === 'now'}
                      onChange={() => setScheduleMode('now')}
                      className="accent-orange-500"
                    />
                    <span className="text-sm text-gray-700">今すぐ（予約）</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleMode"
                      checked={scheduleMode === 'schedule'}
                      onChange={() => setScheduleMode('schedule')}
                      className="accent-orange-500"
                    />
                    <span className="text-sm text-gray-700">日時指定</span>
                  </label>
                </div>
                {scheduleMode === 'schedule' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                )}
              </div>

              {saveError && <p className="text-xs text-red-600">{saveError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !caption.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
