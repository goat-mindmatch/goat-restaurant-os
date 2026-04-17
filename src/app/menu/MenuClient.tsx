'use client'

import { useState } from 'react'

type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  image_url: string | null
}

type CartItem = MenuItem & { quantity: number }

const CATEGORY_LABELS: Record<string, string> = {
  main: '麺メニュー',
  topping: 'トッピング',
  side: 'サイドメニュー',
  drink: 'ドリンク',
  other: 'その他',
}

const CATEGORY_ORDER = ['main', 'topping', 'side', 'drink', 'other']

export default function MenuClient({
  tableNumber,
  items,
}: {
  tableNumber: number
  items: MenuItem[]
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'paypay'>('cash')
  const [note, setNote] = useState('')
  const [ordering, setOrdering] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)

  const totalAmount = cart.reduce((s, it) => s + it.price * it.quantity, 0)
  const totalCount = cart.reduce((s, it) => s + it.quantity, 0)

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === id)
      if (!existing) return prev
      if (existing.quantity <= 1) return prev.filter(c => c.id !== id)
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const handleOrder = async () => {
    if (!cart.length) return
    setOrdering(true)
    try {
      const res = await fetch('/api/menu/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: tableNumber,
          items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity })),
          payment_method: paymentMethod,
          note: note || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrderId(data.order_id)
      setOrdered(true)
      setShowCart(false)
    } catch (e) {
      alert('注文に失敗しました。もう一度お試しください。\n' + (e as Error).message)
    } finally {
      setOrdering(false)
    }
  }

  // 注文完了画面
  if (ordered) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-sm w-full">
          <p className="text-6xl mb-4">🍜</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ご注文ありがとうございます！</h2>
          <p className="text-gray-500 text-sm mb-6">スタッフがすぐに調理を開始します</p>

          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-gray-400 mb-2">ご注文内容</p>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-semibold">¥{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
              <span>合計</span>
              <span>¥{totalAmount.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {paymentMethod === 'cash' ? '💵 お会計はレジにてお支払いください' : '📱 PayPay でのお支払い'}
            </p>
          </div>

          {orderId && (
            <p className="text-xs text-gray-300">注文番号: {orderId.slice(-8).toUpperCase()}</p>
          )}
        </div>
      </div>
    )
  }

  // カテゴリ別メニュー分類
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: items.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white px-4 py-6">
        <h1 className="text-2xl font-bold">🍜 人類みなまぜそば</h1>
        <p className="text-orange-100 text-sm mt-0.5">テーブル {tableNumber}番</p>
      </div>

      {/* メニューリスト */}
      <div className="px-4 mt-4 space-y-6">
        {grouped.map(({ cat, items: catItems }) => (
          <section key={cat}>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">
              {CATEGORY_LABELS[cat] ?? cat}
            </h2>
            <div className="space-y-2">
              {catItems.map(item => {
                const cartItem = cart.find(c => c.id === item.id)
                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-orange-600 font-bold mt-1">¥{item.price.toLocaleString()}</p>
                    </div>
                    {/* 数量コントロール */}
                    {cartItem ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg"
                        >−</button>
                        <span className="w-6 text-center font-bold text-gray-900">{cartItem.quantity}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg"
                        >＋</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="flex-shrink-0 bg-orange-500 text-white font-bold px-4 py-2 rounded-xl text-sm"
                      >
                        追加
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* カートバー（固定） */}
      {totalCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-6 text-base"
          >
            <span className="bg-white/20 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center">
              {totalCount}
            </span>
            <span>注文を確認する</span>
            <span>¥{totalAmount.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* カート確認モーダル */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setShowCart(false)}>
          <div
            className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-4 py-4 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">注文内容の確認</h2>
                <button onClick={() => setShowCart(false)} className="text-gray-400 text-2xl">×</button>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">テーブル {tableNumber}番</p>
            </div>

            {/* 注文リスト */}
            <div className="px-4 py-3 divide-y divide-gray-100">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold">
                        −
                      </button>
                      <span className="w-6 text-center font-bold">{item.quantity}</span>
                      <button onClick={() => addToCart(item)}
                        className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                        ＋
                      </button>
                    </div>
                    <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">¥{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* メモ */}
            <div className="px-4 pb-3">
              <label className="text-xs text-gray-500">スタッフへのメモ（アレルギー等）</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="例: 麺かため、ネギ抜きなど"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1"
              />
            </div>

            {/* 支払方法 */}
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-500 mb-2">お支払い方法</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold ${
                    paymentMethod === 'cash'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  💵 現金（レジ払い）
                </button>
                <button
                  onClick={() => setPaymentMethod('paypay')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold ${
                    paymentMethod === 'paypay'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  📱 PayPay
                </button>
              </div>
              {paymentMethod === 'paypay' && (
                <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">
                  ※ PayPay決済は注文後、スタッフがQRコードをお持ちします
                </p>
              )}
            </div>

            {/* 合計・注文ボタン */}
            <div className="px-4 pb-8">
              <div className="flex justify-between items-center mb-4 text-lg font-bold">
                <span>合計</span>
                <span className="text-orange-600">¥{totalAmount.toLocaleString()}</span>
              </div>
              <button
                onClick={handleOrder}
                disabled={ordering}
                className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-50"
              >
                {ordering ? '注文中...' : '✅ 注文を確定する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
