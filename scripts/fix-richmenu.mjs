/**
 * LINE リッチメニュー 直接修正スクリプト
 * Vercelを介さずローカルから直接LINE APIを叩いて修正する
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local から TOKEN を読み込む
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const tokenMatch = envContent.match(/LINE_STAFF_CHANNEL_ACCESS_TOKEN="([^"]+)"/)
if (!tokenMatch) { console.error('TOKEN が見つかりません'); process.exit(1) }
const TOKEN = tokenMatch[1]

const BASE_URL = 'https://goat-restaurant-os.vercel.app'
const auth     = { Authorization: `Bearer ${TOKEN}` }
const authJson = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

// ─── 正しいメニュー定義（ここが唯一の正本）───
const C = [0, 834, 1667]
const W = [834, 833, 833]
const R = [0, 843]
const H = 843

const STAFF_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Staff Menu v4',
  chatBarText: 'スタッフメニュー',
  areas: [
    { bounds: { x: C[0], y: R[0], width: W[0], height: H }, action: { type: 'message', label: '出勤打刻',      text: '出勤'              } },
    { bounds: { x: C[1], y: R[0], width: W[1], height: H }, action: { type: 'message', label: '退勤打刻',      text: '退勤'              } },
    { bounds: { x: C[2], y: R[0], width: W[2], height: H }, action: { type: 'message', label: 'シフト希望提出', text: 'シフト希望提出'    } },
    { bounds: { x: C[0], y: R[1], width: W[0], height: H }, action: { type: 'message', label: '経営メニューへ', text: '経営メニューへ切替' } },
    { bounds: { x: C[1], y: R[1], width: W[1], height: H }, action: { type: 'message', label: 'ランク確認',     text: '自分のランク'      } }, // ← ここを修正
    { bounds: { x: C[2], y: R[1], width: W[2], height: H }, action: { type: 'message', label: 'シフト確認',     text: 'シフト確認'        } },
  ],
}

const MANAGER_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'GOAT Manager Menu v3',
  chatBarText: '経営メニュー',
  areas: [
    { bounds: { x: C[0], y: R[0], width: W[0], height: H }, action: { type: 'message', label: '売上確認',         text: '本日の売上'                        } },
    { bounds: { x: C[1], y: R[0], width: W[1], height: H }, action: { type: 'uri',     label: 'PL確認',            uri:  `${BASE_URL}/dashboard/pl`           } },
    { bounds: { x: C[2], y: R[0], width: W[2], height: H }, action: { type: 'uri',     label: 'シフト確認',        uri:  `${BASE_URL}/dashboard/shifts`       } },
    { bounds: { x: C[0], y: R[1], width: W[0], height: H }, action: { type: 'message', label: 'スタッフメニューへ', text: 'スタッフメニューへ切替'             } },
    { bounds: { x: C[1], y: R[1], width: W[1], height: H }, action: { type: 'uri',     label: 'RPGランキング',     uri:  `${BASE_URL}/dashboard/rpg`          } }, // ← ここを修正
    { bounds: { x: C[2], y: R[1], width: W[2], height: H }, action: { type: 'uri',     label: 'ダッシュボード',    uri:  `${BASE_URL}/dashboard`              } },
  ],
}

async function run() {
  console.log('=== LINE リッチメニュー 直接修正 ===\n')

  // 1. 既存メニューを全削除
  console.log('【1】既存メニューを確認・削除...')
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: auth })
  const listData = await listRes.json()
  const existing = listData.richmenus ?? []
  console.log(`  現在登録数: ${existing.length}件`)
  for (const m of existing) {
    const delRes = await fetch(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: auth })
    console.log(`  削除: "${m.name}" → ${delRes.ok ? '✅' : '❌'} (${delRes.status})`)
  }

  // 2. スタッフメニュー作成
  console.log('\n【2】スタッフメニュー (v4) を作成...')
  const staffRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST', headers: authJson, body: JSON.stringify(STAFF_MENU)
  })
  if (!staffRes.ok) {
    console.error('  ❌ スタッフメニュー作成失敗:', await staffRes.text())
    process.exit(1)
  }
  const { richMenuId: staffId } = await staffRes.json()
  console.log(`  ✅ スタッフメニュー ID: ${staffId}`)
  console.log(`     ボタン5: "${STAFF_MENU.areas[4].action.text}" (自分のランク であることを確認)`)

  // 3. 経営者メニュー作成
  console.log('\n【3】経営者メニュー (v3) を作成...')
  const mgRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST', headers: authJson, body: JSON.stringify(MANAGER_MENU)
  })
  if (!mgRes.ok) {
    console.error('  ❌ 経営者メニュー作成失敗:', await mgRes.text())
    process.exit(1)
  }
  const { richMenuId: managerId } = await mgRes.json()
  console.log(`  ✅ 経営者メニュー ID: ${managerId}`)
  console.log(`     ボタン5: "${MANAGER_MENU.areas[4].action.uri}" (RPGランキング であることを確認)`)

  // 4. スタッフメニューを全員に適用
  console.log('\n【4】全スタッフにスタッフメニューを適用...')
  const allRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${staffId}`, { method: 'POST', headers: auth })
  console.log(`  全員適用: ${allRes.ok ? '✅' : '❌'} (${allRes.status})`)

  // 5. デフォルト設定
  console.log('\n【5】デフォルトメニューを設定...')
  const defRes = await fetch(`https://api.line.me/v2/bot/richmenu/default/${staffId}`, { method: 'POST', headers: auth })
  console.log(`  デフォルト設定: ${defRes.ok ? '✅' : '⚠️'} (${defRes.status}) ${!defRes.ok ? '※プランによっては設定不可（無視してOK）' : ''}`)

  // 6. 結果確認
  console.log('\n【6】修正後の確認...')
  const checkRes = await fetch('https://api.line.me/v2/bot/richmenu/list', { headers: auth })
  const checkData = await checkRes.json()
  for (const m of checkData.richmenus ?? []) {
    console.log(`  メニュー: "${m.name}"`)
    for (const [i, a] of m.areas.entries()) {
      const val = a.action.type === 'message' ? a.action.text : a.action.uri
      console.log(`    ボタン${i+1}: ${val}`)
    }
  }

  console.log('\n=== 完了 ===')
  console.log('次のステップ: 設定ページから スタッフ用・経営者用の画像をアップロードしてください')
  console.log('その後、LINEアプリを完全に終了して再起動してください')
}

run().catch(console.error)
