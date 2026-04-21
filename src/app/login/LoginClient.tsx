'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginClient() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const nextPath    = searchParams.get('next') ?? '/dashboard/tasks'

  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(finalPin: string) {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin: finalPin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました')
        setPin('')
        return
      }
      // 経営者はダッシュボードへ、スタッフはタスクへ
      const dest = data.role === 'manager'
        ? (nextPath.startsWith('/dashboard') ? nextPath : '/dashboard')
        : '/dashboard/tasks'
      router.replace(dest)
    } catch {
      setError('通信エラーが発生しました')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  function press(val: string) {
    if (loading) return
    if (val === 'del') {
      setPin(p => p.slice(0, -1))
      setError('')
      return
    }
    const next = pin + val
    setPin(next)
    if (next.length >= 4) {
      handleLogin(next)
    }
  }

  const KEYS = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['','0','del'],
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      {/* ロゴ */}
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">🍜</div>
        <h1 className="text-xl font-black text-gray-900">人類みなまぜそば</h1>
        <p className="text-sm text-gray-500 mt-1">スタッフ管理システム</p>
      </div>

      {/* PIN表示 */}
      <div className="flex gap-4 mb-6">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all ${
              pin.length > i
                ? 'bg-orange-500 scale-110'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* エラー */}
      {error && (
        <p className="text-sm text-red-500 mb-4 font-medium animate-pulse">{error}</p>
      )}

      {loading && (
        <p className="text-sm text-gray-400 mb-4">確認中...</p>
      )}

      {/* テンキー */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {KEYS.flat().map((k, i) => (
          k === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => press(k)}
              disabled={loading}
              className={`
                h-16 rounded-2xl text-xl font-bold transition-all active:scale-95
                ${k === 'del'
                  ? 'bg-gray-200 text-gray-600 text-base'
                  : 'bg-white shadow text-gray-900 hover:bg-orange-50 hover:text-orange-600'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {k === 'del' ? '⌫' : k}
            </button>
          )
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        PINを入力してログインしてください
      </p>
    </div>
  )
}
