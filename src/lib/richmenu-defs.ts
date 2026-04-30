/**
 * LINEリッチメニュー定義 — 唯一の正本
 *
 * このファイルを変更すれば
 *   - setup-richmenu
 *   - upload-richmenu-image
 *   - set-default-richmenu
 * すべてに自動で反映される。
 *
 * ボタン座標: 2500×1686 を 3列×2行に分割
 *   列幅: 834 + 833 + 833 = 2500
 *   行高: 843 + 843       = 1686
 */

const BASE_URL = 'https://goat-restaurant-os.vercel.app'

const C = [0, 834, 1667]   // 各列の x 開始座標
const W = [834, 833, 833]   // 各列の幅
const R = [0, 843]           // 各行の y 開始座標
const H = 843                // 行の高さ

// ─────────────────────────────────────────
// スタッフ用（全スタッフに表示）v5
// 上段: 出勤打刻 / 退勤打刻 / ダッシュボード
// 下段: シフト提出 / 自分のランク / 意見箱
// ─────────────────────────────────────────
export const STAFF_MENU_DEF = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Staff Menu v5',
  chatBarText: 'スタッフメニュー',
  areas: [
    { bounds: { x: C[0], y: R[0], width: W[0], height: H }, action: { type: 'message', label: '出勤打刻',        text: '出勤'                             } },
    { bounds: { x: C[1], y: R[0], width: W[1], height: H }, action: { type: 'message', label: '退勤打刻',        text: '退勤'                             } },
    { bounds: { x: C[2], y: R[0], width: W[2], height: H }, action: { type: 'uri',     label: 'ダッシュボード',  uri: `${BASE_URL}/staff-home`            } },
    { bounds: { x: C[0], y: R[1], width: W[0], height: H }, action: { type: 'message', label: 'シフト提出',      text: 'シフト希望提出'                   } },
    { bounds: { x: C[1], y: R[1], width: W[1], height: H }, action: { type: 'uri',     label: '自分のランク',    uri: `${BASE_URL}/dashboard/rpg`         } },
    { bounds: { x: C[2], y: R[1], width: W[2], height: H }, action: { type: 'uri',     label: '意見箱',          uri: `${BASE_URL}/improve`               } },
  ],
} as const

// ─────────────────────────────────────────
// 経営者用（role=manager に個別適用）
// 上段: 売上確認 / PL確認 / シフト確認
// 下段: スタッフメニューへ / 🏆RPGランキング / ダッシュボード
// ─────────────────────────────────────────
export const MANAGER_MENU_DEF = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Manager Menu v3',
  chatBarText: '経営メニュー',
  areas: [
    { bounds: { x: C[0], y: R[0], width: W[0], height: H }, action: { type: 'message', label: '売上確認',       text: '本日の売上'                        } },
    { bounds: { x: C[1], y: R[0], width: W[1], height: H }, action: { type: 'uri',     label: 'PL確認',          uri: `${BASE_URL}/dashboard/pl`           } },
    { bounds: { x: C[2], y: R[0], width: W[2], height: H }, action: { type: 'uri',     label: 'シフト確認',      uri: `${BASE_URL}/dashboard/shifts`       } },
    { bounds: { x: C[0], y: R[1], width: W[0], height: H }, action: { type: 'message', label: 'スタッフメニューへ', text: 'スタッフメニューへ切替'           } },
    { bounds: { x: C[1], y: R[1], width: W[1], height: H }, action: { type: 'uri',     label: 'RPGランキング',   uri: `${BASE_URL}/dashboard/rpg`          } },
    { bounds: { x: C[2], y: R[1], width: W[2], height: H }, action: { type: 'uri',     label: 'ダッシュボード',  uri: `${BASE_URL}/dashboard`              } },
  ],
} as const

export const STAFF_MENU_NAME   = STAFF_MENU_DEF.name    // 'GOAT Staff Menu v5'
export const MANAGER_MENU_NAME = MANAGER_MENU_DEF.name  // 'GOAT Manager Menu v3'
