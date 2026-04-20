'use client'

import { useState } from 'react'

type Lang = 'ja' | 'en' | 'zh'

type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  image_url: string | null
  name_en: string | null
  name_zh: string | null
  description_en: string | null
  description_zh: string | null
}

const LANG_LABELS: Record<Lang, string> = { ja: '🇯🇵 日本語', en: '🇺🇸 EN', zh: '🇨🇳 中文' }

const CATEGORY_LABELS_I18N: Record<Lang, Record<string, string>> = {
  ja: { main: '麺メニュー', topping: 'トッピング', side: 'サイドメニュー', drink: 'ドリンク', other: 'その他' },
  en: { main: 'Noodles', topping: 'Toppings', side: 'Sides', drink: 'Drinks', other: 'Others' },
  zh: { main: '面类', topping: '配料', side: '小食', drink: '饮品', other: '其他' },
}

const UI_TEXT: Record<Lang, Record<string, string>> = {
  ja: {
    table: 'テーブル',
    addCart: '追加',
    confirmOrder: '注文を確認する',
    orderConfirm: '注文内容の確認',
    memo: 'スタッフへのメモ（アレルギー等）',
    memoPlaceholder: '例: 麺かため、ネギ抜きなど',
    payment: 'お支払い方法',
    cash: '💵 現金（レジ払い）',
    paypay: '📱 PayPay',
    paypayNote: '※ PayPay決済は注文後、スタッフがQRコードをお持ちします',
    total: '合計',
    submitOrder: '✅ 注文を確定する',
    ordering: '注文中...',
    thankYou: 'ご注文ありがとうございます！',
    thankYouSub: 'スタッフがすぐに調理を開始します',
    orderContent: 'ご注文内容',
    cashNote: '💵 お会計はレジにてお支払いください',
  },
  en: {
    table: 'Table',
    addCart: 'Add',
    confirmOrder: 'View Order',
    orderConfirm: 'Order Summary',
    memo: 'Notes (allergies, etc.)',
    memoPlaceholder: 'e.g., extra firm noodles, no green onions',
    payment: 'Payment Method',
    cash: '💵 Cash (pay at register)',
    paypay: '📱 PayPay',
    paypayNote: '* Staff will bring a PayPay QR code after your order.',
    total: 'Total',
    submitOrder: '✅ Place Order',
    ordering: 'Ordering...',
    thankYou: 'Thank you for your order!',
    thankYouSub: 'Staff will begin preparing your food soon.',
    orderContent: 'Order Details',
    cashNote: '💵 Please pay at the register.',
  },
  zh: {
    table: '桌号',
    addCart: '添加',
    confirmOrder: '查看订单',
    orderConfirm: '订单确认',
    memo: '备注（过敏等）',
    memoPlaceholder: '例如：面条硬一点，不要葱',
    payment: '支付方式',
    cash: '💵 现金（收银台付款）',
    paypay: '📱 PayPay',
    paypayNote: '※ 下单后工作人员会带PayPay二维码过来',
    total: '合计',
    submitOrder: '✅ 确认下单',
    ordering: '下单中...',
    thankYou: '感谢您的订单！',
    thankYouSub: '工作人员马上开始为您准备。',
    orderContent: '订单内容',
    cashNote: '💵 请在收银台结账。',
  },
}

type CartItem = MenuItem & { quantity: number }

const CATEGORY_ORDER = ['main', 'topping', 'side', 'drink', 'other']

export default function MenuClient({
  tableNumber,
  items,
  initialLang = 'ja',
}: {
  tableNumber: number
  items: MenuItem[]
  initialLang?: Lang
}) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = UI_TEXT[lang]
  const catLabels = CATEGORY_LABELS_I18N[lang]

  // 言語に応じた表示名取得
  const itemName = (item: MenuItem) =>
    (lang === 'en' && item.name_en) ? item.name_en :
    (lang === 'zh' && item.name_zh) ? item.name_zh :
    item.name

  const itemDesc = (item: MenuItem) =>
    (lang === 'en' && item.description_en) ? item.description_en :
    (lang === 'zh' && item.description_zh) ? item.description_zh :
    item.description

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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.thankYou}</h2>
          <p className="text-gray-500 text-sm mb-6">{t.thankYouSub}</p>

          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-gray-400 mb-2">{t.orderContent}</p>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-700">{itemName(item)} × {item.quantity}</span>
                <span className="font-semibold">¥{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
              <span>{t.total}</span>
              <span>¥{totalAmount.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {paymentMethod === 'cash' ? t.cashNote : t.paypay}
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">🍜 人類みなまぜそば</h1>
            <p className="text-orange-100 text-sm mt-0.5">{t.table} {tableNumber}</p>
          </div>
          {/* 言語切り替え */}
          <div className="flex flex-col gap-1 mt-1">
            {(['ja', 'en', 'zh'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                  lang === l ? 'bg-white text-orange-600' : 'bg-white/20 text-white'
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* メニューリスト */}
      <div className="px-4 mt-4 space-y-6">
        {grouped.map(({ cat, items: catItems }) => (
          <section key={cat}>
            <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">
              {catLabels[cat] ?? cat}
            </h2>
            <div className="space-y-2">
              {catItems.map(item => {
                const cartItem = cart.find(c => c.id === item.id)
                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
                    {/* 画像（あれば） */}
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={itemName(item)}
                        className="w-16 h-16 rounded-xl object-cover mr-3 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-bold text-gray-900">{itemName(item)}</p>
                      {itemDesc(item) && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{itemDesc(item)}</p>
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
                        {t.addCart}
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
            <span>{t.confirmOrder}</span>
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
                <h2 className="text-lg font-bold text-gray-900">{t.orderConfirm}</h2>
                <button onClick={() => setShowCart(false)} className="text-gray-400 text-2xl">×</button>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{t.table} {tableNumber}</p>
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
              <label className="text-xs text-gray-500">{t.memo}</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t.memoPlaceholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1"
              />
            </div>

            {/* 支払方法 */}
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-500 mb-2">{t.payment}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold ${
                    paymentMethod === 'cash'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {t.cash}
                </button>
                <button
                  onClick={() => setPaymentMethod('paypay')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold ${
                    paymentMethod === 'paypay'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {t.paypay}
                </button>
              </div>
              {paymentMethod === 'paypay' && (
                <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg p-2">
                  {t.paypayNote}
                </p>
              )}
            </div>

            {/* 合計・注文ボタン */}
            <div className="px-4 pb-8">
              <div className="flex justify-between items-center mb-4 text-lg font-bold">
                <span>{t.total}</span>
                <span className="text-orange-600">¥{totalAmount.toLocaleString()}</span>
              </div>
              <button
                onClick={handleOrder}
                disabled={ordering}
                className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-50"
              >
                {ordering ? t.ordering : t.submitOrder}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
