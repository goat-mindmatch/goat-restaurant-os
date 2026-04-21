'use client'

/**
 * まぜそばマニュアル クライアントコンポーネント
 * タブ: 調理手順 / 朝の仕込み / 夜間片付け / 食材保存 / 発注スケジュール
 */

import { useState } from 'react'
import Link from 'next/link'

type Tab = 'cooking' | 'morning' | 'closing' | 'storage' | 'order'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'cooking',  label: '調理手順',   icon: '🍜' },
  { id: 'morning',  label: '朝仕込み',   icon: '🌅' },
  { id: 'closing',  label: '夜片付け',   icon: '🌙' },
  { id: 'storage',  label: '食材保存',   icon: '🗃️' },
  { id: 'order',    label: '発注',       icon: '📦' },
]

// ─── 調理手順 ──────────────────────────────────────────
function CookingTab() {
  const menus = [
    {
      name: '人類みなまぜそば（定番）',
      icon: '🍜',
      color: 'border-orange-300',
      ingredients: [
        { item: 'カエシ', amount: '規定量' },
        { item: 'カツオ香味油', amount: '規定量' },
        { item: 'チャーシュー', amount: '50g' },
        { item: 'ニラ', amount: '10g' },
        { item: '玉ねぎ（みじん切り）', amount: '10g' },
        { item: 'メンマ', amount: '10g' },
        { item: '白髪ネギ', amount: '10g' },
      ],
    },
    {
      name: '人類みな日本',
      icon: '🌸',
      color: 'border-pink-300',
      ingredients: [
        { item: 'カエシ', amount: '規定量' },
        { item: '煮干し香味油', amount: '規定量' },
        { item: 'チャーシュー', amount: '50g' },
        { item: '梅干し', amount: '2個' },
        { item: '大葉', amount: '規定量' },
        { item: 'ニラ/玉ねぎ/メンマ/白髪ネギ', amount: '各10g' },
      ],
    },
    {
      name: '人類みな韓国',
      icon: '🌶️',
      color: 'border-red-300',
      ingredients: [
        { item: 'カエシ', amount: '規定量' },
        { item: 'ピリ辛香味油', amount: '規定量' },
        { item: 'チャーシュー', amount: '50g' },
        { item: 'キムチ', amount: '25g' },
        { item: '韓国海苔', amount: '2g' },
        { item: 'ニラ/玉ねぎ/メンマ/白髪ネギ', amount: '各10g' },
      ],
    },
    {
      name: '何の変哲もないまぜそば',
      icon: '⚪',
      color: 'border-gray-300',
      ingredients: [
        { item: 'カエシ', amount: '規定量' },
        { item: '刻みチャーシュー', amount: '25g' },
        { item: '白髪ネギ', amount: '7g' },
      ],
    },
  ]

  const toppings = ['煮卵', '追いチャーシュー', 'チーズ', 'ニンニク']

  const sideMenus = [
    { name: '〆めし', note: '残ったスープにご飯を入れる' },
    { name: '炙りチャーマヨ丼', note: '炙りチャーシュー＋マヨネーズ' },
    { name: 'ミニチャーマヨ丼', note: '小サイズ' },
    { name: '追麺', note: '麺を追加' },
    { name: 'おつまみピリ辛ネギ', note: '白髪ネギ＋刻みニラ' },
    { name: 'おつまみメンマ', note: 'タッパー保管品' },
  ]

  return (
    <div className="space-y-4">
      {/* 標準提供時間 */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm font-bold text-orange-800 mb-1">⏱️ 標準提供時間</p>
        <p className="text-2xl font-black text-orange-600">5〜10分</p>
        <p className="text-xs text-orange-700 mt-1">注文受付から提供まで。混雑時も10分を目標に。</p>
      </div>

      {/* 調理フロー */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-700 mb-3">📋 調理フロー（5ステップ）</p>
        {[
          { step: 1, text: '丼に カエシ＋香味油 を入れる' },
          { step: 2, text: '麺を規定時間茹でる（ゆで麺機）' },
          { step: 3, text: '麺をよく湯切りして丼に移す' },
          { step: 4, text: 'メニュー別の具材をのせる' },
          { step: 5, text: 'トッピング（追加注文分）をのせて完成' },
        ].map(s => (
          <div key={s.step} className="flex items-start gap-3 py-2 border-b last:border-0 border-gray-50">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {s.step}
            </div>
            <p className="text-sm text-gray-700">{s.text}</p>
          </div>
        ))}
      </div>

      {/* メニュー別具材 */}
      <div>
        <p className="text-xs font-bold text-gray-400 mb-2">メニュー別 具材構成</p>
        <div className="space-y-3">
          {menus.map(menu => (
            <div key={menu.name} className={`bg-white rounded-xl border-2 ${menu.color} shadow-sm p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{menu.icon}</span>
                <p className="font-bold text-gray-800 text-sm">{menu.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {menu.ingredients.map(ing => (
                  <div key={ing.item} className="flex justify-between text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                    <span className="text-gray-600">{ing.item}</span>
                    <span className="font-bold text-gray-800">{ing.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* トッピング */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-700 mb-2">🥚 トッピング</p>
        <div className="flex flex-wrap gap-2">
          {toppings.map(t => (
            <span key={t} className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* ご飯・一品 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-700 mb-2">🍚 ご飯・一品メニュー</p>
        <div className="space-y-2">
          {sideMenus.map(s => (
            <div key={s.name} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0 border-gray-50">
              <span className="font-medium text-gray-800">{s.name}</span>
              <span className="text-xs text-gray-400">{s.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 朝の仕込み ──────────────────────────────────────
function MorningTab() {
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const toggleCheck = (i: number) => {
    setChecked(prev => ({ ...prev, [i]: !prev[i] }))
  }

  const steps = [
    { num: 1,  title: '肉の準備', detail: 'チャーシュー用の肉を4等分にカット' },
    { num: 2,  title: '圧力鍋セット', detail: '圧力鍋に肉を入れ、65分タイマーをセット' },
    { num: 3,  title: 'ゆで麺機セット', detail: '麺機の電源を入れて適温に予熱' },
    { num: 4,  title: '作業台準備', detail: 'ラップを3枚セット' },
    { num: 5,  title: '道具準備', detail: 'トング・ハサミ・スプーンを所定位置に配置' },
    { num: 6,  title: '蒸し器準備', detail: 'チャー丼用の蒸し器をセット' },
    { num: 7,  title: '器温め', detail: '寸胴で器をお湯で温める' },
    { num: 8,  title: 'お米準備', detail: '平日: 6〜7合 / 休日: 8〜9合（大麦10g/合）' },
    { num: 9,  title: 'タレ類補充', detail: 'カエシ・カツオ油を各1500mlに補充' },
    { num: 10, title: '具材準備', detail: '煮卵・チャー丼用タレ・マヨネーズを準備' },
    { num: 11, title: '野菜仕込み', detail: '①ニラ5束を1㎝幅カット ②メンマ1kgを1㎝角カット ③玉ねぎ4玉をみじん切り（5mm角）' },
    { num: 12, title: '麺ぶ用寸胴', detail: '湯沸かし用寸胴をセット' },
    { num: 13, title: '麺箱準備', detail: '昼: 4箱（100玉） / 夜: 3箱（75玉）' },
    { num: 14, title: '包丁・まな板セット', detail: '所定位置に配置・清潔を確認' },
    { num: 15, title: 'ティファールに水', detail: '1500mlの水をセットしてON' },
  ]

  const done = Object.values(checked).filter(Boolean).length
  const pct = Math.round((done / steps.length) * 100)

  return (
    <div className="space-y-4">
      {/* タイムライン */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm font-bold text-orange-800 mb-2">🕐 タイムライン目標</p>
        <div className="flex gap-3 text-sm">
          <div className="flex-1 bg-white rounded-lg p-2 text-center">
            <p className="font-black text-orange-600">9:30</p>
            <p className="text-xs text-gray-500">作業開始</p>
          </div>
          <div className="flex-1 bg-white rounded-lg p-2 text-center">
            <p className="font-black text-green-600">10:00</p>
            <p className="text-xs text-gray-500">Step1-8完了</p>
          </div>
          <div className="flex-1 bg-white rounded-lg p-2 text-center">
            <p className="font-black text-blue-600">10:45</p>
            <p className="text-xs text-gray-500">全作業完了</p>
          </div>
        </div>
      </div>

      {/* 進捗 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-gray-700">進捗チェック</span>
          <span className="text-sm font-black text-orange-600">{done}/{steps.length}({pct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {done === steps.length && (
          <p className="text-center text-green-600 font-bold text-sm mt-2">✅ 仕込み完了！</p>
        )}
      </div>

      {/* 仕込みチェックリスト */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {steps.map(step => (
          <button
            key={step.num}
            onClick={() => toggleCheck(step.num)}
            className="w-full flex items-start gap-3 p-4 text-left transition-colors"
            style={checked[step.num] ? { background: '#f0fdf4' } : {}}
          >
            <div className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${
              checked[step.num]
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 text-gray-400'
            }`}>
              {checked[step.num] ? '✓' : step.num}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${checked[step.num] ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                {step.title}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{step.detail}</p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setChecked({})}
        className="w-full py-3 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 bg-white"
      >
        チェックをリセット
      </button>

      {/* 仕込みタスクへのリンク */}
      <Link
        href="/dashboard/tasks"
        className="block w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm text-center"
      >
        📋 仕込みタスク管理ページへ →
      </Link>
    </div>
  )
}

// ─── 夜間片付け ──────────────────────────────────────
function ClosingTab() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setChecked(p => ({ ...p, [k]: !p[k] }))

  const hallTasks = [
    'テーブル・椅子を拭く',
    'カウンター・棚を拭く',
    '床を掃く（ほうき）',
    '床を拭く（モップ）',
    'ゴミをまとめる（燃えるゴミ）',
    '空調をOFF',
    '照明チェック（消灯確認）',
    'ドア・窓の施錠確認',
    'メニュースタンドを片付ける',
    '入口・のれんを片付ける',
  ]

  const kitchenTasks = [
    '麺機の清掃・排水',
    '寸胴（湯）の片付け',
    'カエシ・香味油を蓋して保管',
    '残った具材をラップして冷蔵',
    'チャーシュー・煮卵を冷蔵保管',
    '切り残し野菜（ニラ・玉ねぎ）をタッパーへ',
    'まな板・包丁を洗浄・消毒',
    'フライパン・鍋を洗う',
    'シンクの清掃',
    'ガスコンロを拭く',
    '換気扇フィルターを確認',
    '冷蔵庫の温度チェック',
    '蒸し器の水を捨てる',
    'ティファールの水を捨てる',
    'ゴミ袋を交換',
    '作業台をアルコール拭き',
    '床をデッキブラシ',
    'グリストラップ確認',
  ]

  const cashSteps = [
    '当日売上 ＋ Uber Eats売上 を合算する',
    'レジ残高を6万円に設定する',
    '余剰分を封筒に入れて金庫へ',
    'LINEグループに売上報告（「本日売上: ¥○○○,○○○」形式）',
  ]

  const allTasks = [...hallTasks.map((_,i) => `hall_${i}`), ...kitchenTasks.map((_,i) => `kitchen_${i}`)]
  const done = allTasks.filter(k => checked[k]).length
  const pct = Math.round((done / allTasks.length) * 100)

  return (
    <div className="space-y-4">
      {/* タイムライン */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-bold text-blue-800 mb-2">🕐 タイムライン目標</p>
        <div className="flex gap-2 text-sm">
          <div className="flex-1 bg-white rounded-lg p-2 text-center">
            <p className="font-black text-blue-600">20:30</p>
            <p className="text-xs text-gray-500">作業開始</p>
          </div>
          <div className="flex-1 bg-white rounded-lg p-2 text-center">
            <p className="font-black text-orange-600">21:30</p>
            <p className="text-xs text-gray-500">ホール完了</p>
          </div>
          <div className="flex-1 bg-white rounded-lg p-2 text-center">
            <p className="font-black text-green-600">22:00</p>
            <p className="text-xs text-gray-500">キッチン完了</p>
          </div>
        </div>
      </div>

      {/* 進捗 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>片付け進捗</span>
          <span className="font-bold text-blue-600">{done}/{allTasks.length}({pct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ホール作業 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
          <p className="text-sm font-bold text-amber-800">🪑 ホール作業（10項目 / 21:30完了）</p>
        </div>
        {hallTasks.map((task, i) => (
          <button
            key={i}
            onClick={() => toggle(`hall_${i}`)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-0 border-gray-50 transition-colors"
            style={checked[`hall_${i}`] ? { background: '#f0fdf4' } : {}}
          >
            <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-all ${
              checked[`hall_${i}`] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
            }`}>
              {checked[`hall_${i}`] ? '✓' : ''}
            </div>
            <span className={`text-sm ${checked[`hall_${i}`] ? 'text-green-700 line-through' : 'text-gray-700'}`}>{task}</span>
          </button>
        ))}
      </div>

      {/* キッチン作業 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
          <p className="text-sm font-bold text-blue-800">👨‍🍳 キッチン作業（18項目 / 22:00完了）</p>
        </div>
        {kitchenTasks.map((task, i) => (
          <button
            key={i}
            onClick={() => toggle(`kitchen_${i}`)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-0 border-gray-50 transition-colors"
            style={checked[`kitchen_${i}`] ? { background: '#f0fdf4' } : {}}
          >
            <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-all ${
              checked[`kitchen_${i}`] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
            }`}>
              {checked[`kitchen_${i}`] ? '✓' : ''}
            </div>
            <span className={`text-sm ${checked[`kitchen_${i}`] ? 'text-green-700 line-through' : 'text-gray-700'}`}>{task}</span>
          </button>
        ))}
      </div>

      {/* レジ締め */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-green-50 px-4 py-2 border-b border-green-100">
          <p className="text-sm font-bold text-green-800">💴 レジ締め（4ステップ）</p>
        </div>
        {cashSteps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b last:border-0 border-gray-50">
            <div className="shrink-0 w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </div>
            <span className="text-sm text-gray-700">{step}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setChecked({})}
        className="w-full py-3 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 bg-white"
      >
        チェックをリセット
      </button>
    </div>
  )
}

// ─── 食材保存 ─────────────────────────────────────────
function StorageTab() {
  const items = [
    { name: '麺',          storage: '冷蔵',     note: '配達当日使い切り推奨' },
    { name: 'カエシ',      storage: '常温',     note: '開封後は冷蔵' },
    { name: 'カツオ香味油', storage: '常温',    note: '開封後は冷蔵' },
    { name: '煮干し香味油', storage: '常温',    note: '開封後は冷蔵' },
    { name: 'ピリ辛香味油', storage: '常温',    note: '開封後は冷蔵' },
    { name: 'チャーダレ',   storage: '常温',    note: '開封後は冷蔵' },
    { name: 'チャーシュー（前日仕込み後）', storage: '冷蔵', note: '翌日用は必ず冷蔵' },
    { name: 'チャーシュー（当日仕込み後）', storage: '常温', note: 'その日の営業中は常温OK' },
    { name: 'ニラ',        storage: '常温',     note: '当日用タッパーに入れて常温' },
    { name: '玉ねぎ（みじん切り）', storage: '常温', note: '当日用タッパーに入れて常温' },
    { name: '白髪ネギ',    storage: '常温',     note: '当日用タッパーに入れて常温' },
    { name: 'メンマ',      storage: '常温',     note: '常温保管OK' },
    { name: '梅干し',      storage: '常温',     note: '開封後は冷蔵' },
    { name: '大葉',        storage: '冷蔵',     note: '当日使用分は常温に出す' },
    { name: '韓国海苔',    storage: '常温',     note: '開封後はタッパーに入れて冷蔵' },
    { name: '煮卵',        storage: '常温',     note: '味付け後20個まで常温OK' },
    { name: 'チーズ',      storage: '冷凍',     note: '当日分100〜150gを冷蔵に移す' },
    { name: 'ニンニク（みじん切り）', storage: '冷蔵', note: '100〜150g小分け冷蔵' },
    { name: '旨辛キムチ',  storage: '冷蔵',     note: '常時冷蔵' },
    { name: 'おつまみピリ辛ネギ', storage: '常温', note: '白髪ネギ＋刻みニラを常温で' },
    { name: 'おつまみメンマ', storage: '冷蔵',  note: 'タッパーに入れて冷蔵' },
  ]

  const storageColors: Record<string, string> = {
    '冷蔵': 'bg-blue-100 text-blue-700',
    '冷凍': 'bg-indigo-100 text-indigo-700',
    '常温': 'bg-green-100 text-green-700',
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">常温</span>
        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">冷蔵</span>
        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">冷凍</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {items.map(item => (
          <div key={item.name} className="flex items-center justify-between px-4 py-3 gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-400">{item.note}</p>
            </div>
            <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-bold ${storageColors[item.storage]}`}>
              {item.storage}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 発注スケジュール ──────────────────────────────────
function OrderTab() {
  const schedule = [
    {
      item: '麺',
      days: [
        { day: '水・木', label: '水・木配達分' },
        { day: '金',     label: '金曜分' },
        { day: '土・日', label: '土日分' },
        { day: '日',     label: '翌週月〜' },
      ],
      note: '配達リードタイムを確認して発注'
    },
    {
      item: '野菜（ニラ・玉ねぎ）',
      days: [
        { day: '木〜土', label: '週前半発注' },
        { day: '土〜火', label: '週後半発注' },
      ],
      note: '鮮度管理。使いきれる量を発注'
    },
    {
      item: 'タレ類',
      days: [{ day: 'その都度', label: '残量1500ml以下になったら' }],
      note: 'カエシ・香味油は1500ml基準'
    },
    {
      item: '豚肉',
      days: [
        { day: '木', label: '木曜発注' },
        { day: '日', label: '日曜発注' },
      ],
      note: '仕込みスケジュールに合わせて'
    },
    {
      item: '玉子',
      days: [
        { day: '木', label: '木曜' },
        { day: '土', label: '土曜' },
        { day: '火', label: '火曜' },
      ],
      note: '煮卵は常時20個をキープ'
    },
    {
      item: 'メンマ・ドリンク',
      days: [{ day: '残量基準', label: '在庫を確認して発注' }],
      note: '目視確認が基本'
    },
    {
      item: '梅干し・キムチ・韓国のり',
      days: [{ day: '残量基準', label: '在庫を確認して発注' }],
      note: '在庫が1週間分を下回ったら'
    },
  ]

  return (
    <div className="space-y-3">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">
        📦 発注タイミングを守ることで食材ロスを防ぎます。在庫が不安なときは早めに発注。
      </div>

      {schedule.map(s => (
        <div key={s.item} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">📦</span>
            <div>
              <p className="font-bold text-gray-800 text-sm">{s.item}</p>
              <p className="text-xs text-gray-400">{s.note}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.days.map(d => (
              <div key={d.day} className="bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 text-center">
                <p className="text-xs font-bold text-orange-700">{d.day}</p>
                <p className="text-[10px] text-orange-500">{d.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Link
        href="/dashboard/orders"
        className="block w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm text-center"
      >
        📦 発注管理ページへ →
      </Link>
    </div>
  )
}

// ─── メインコンポーネント ─────────────────────────────
export default function ManualClient() {
  const [tab, setTab] = useState<Tab>('cooking')

  return (
    <div>
      {/* タブナビ */}
      <div className="flex overflow-x-auto gap-1 px-4 pt-4 pb-2 no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t.id
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div className="px-4 pt-2 pb-4">
        {tab === 'cooking'  && <CookingTab />}
        {tab === 'morning'  && <MorningTab />}
        {tab === 'closing'  && <ClosingTab />}
        {tab === 'storage'  && <StorageTab />}
        {tab === 'order'    && <OrderTab />}
      </div>
    </div>
  )
}
