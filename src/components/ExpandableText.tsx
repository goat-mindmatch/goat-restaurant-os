'use client'

/**
 * 長いテキストを2行で折りたたみ、「続きを読む」で全文展開するコンポーネント
 */

import { useState } from 'react'

type Props = {
  text: string
  className?: string
  /** 折りたたみを始める目安の文字数（デフォルト60文字） */
  threshold?: number
}

export default function ExpandableText({ text, className = '', threshold = 60 }: Props) {
  const [expanded, setExpanded] = useState(false)
  const needsToggle = text.length > threshold

  return (
    <div>
      <p className={`text-xs text-gray-600 ${needsToggle && !expanded ? 'line-clamp-2' : ''} ${className}`}>
        {text}
      </p>
      {needsToggle && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="text-[10px] text-blue-500 mt-0.5 hover:underline"
        >
          {expanded ? '閉じる ▲' : '続きを読む ▼'}
        </button>
      )}
    </div>
  )
}
