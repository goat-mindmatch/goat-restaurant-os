#!/usr/bin/env node
/**
 * setup-delivery-session.js
 * デリバリーサービスのセッションファイルを作成するセットアップスクリプト
 *
 * 使い方:
 *   node scripts/setup-delivery-session.js uber       → Uber Eats
 *   node scripts/setup-delivery-session.js rocketnow  → RocketNow
 *   node scripts/setup-delivery-session.js anydeli    → AnyDeli（既存）
 *
 * 実行後:
 *   sessions/{service}-session.json が作成されます。
 *   base64 -i sessions/{service}-session.json | pbcopy
 *   でクリップボードにコピーして GitHub Secrets に貼り付けてください。
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const SERVICE = process.argv[2]

const SERVICES = {
  uber: {
    name:    'Uber Eats',
    url:     'https://restaurant.uber.com/',
    message: 'Uber Eats Manager にログインしてください。ログイン完了後、Enter を押してください。',
    check:   (url) => !url.includes('login') && !url.includes('auth'),
    secret:  'UBER_SESSION_B64',
  },
  rocketnow: {
    name:    'RocketNow',
    url:     'https://merchant.rocketnow.jp/',
    message: 'RocketNow パートナーポータルにログインしてください。ログイン完了後、Enter を押してください。',
    check:   (url) => !url.includes('login') && !url.includes('signin'),
    secret:  'ROCKETNOW_SESSION_B64',
  },
  anydeli: {
    name:    'AnyDeli',
    url:     'https://shop.anydeli.co.jp/',
    message: 'AnyDeli にログインしてください。ログイン完了後、Enter を押してください。',
    check:   (url) => !url.includes('login'),
    secret:  'ANYDELI_SESSION',
  },
}

if (!SERVICE || !SERVICES[SERVICE]) {
  console.error(`使い方: node scripts/setup-delivery-session.js [uber|rocketnow|anydeli]`)
  process.exit(1)
}

const config = SERVICES[SERVICE]

async function main() {
  console.log(`\n🔑 ${config.name} セッションセットアップ`)
  console.log('=========================================')

  const browser = await chromium.launch({
    headless: false,  // ブラウザを表示してログインしてもらう
    args: ['--no-sandbox'],
  })

  const context = await browser.newContext({
    locale:    'ja-JP',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  console.log(`\n📌 ${config.message}`)
  console.log('（ブラウザウィンドウが開きます）\n')

  // ユーザーがログインするまで待機
  await new Promise((resolve) => {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      resolve()
    })
    console.log('ログイン完了したら Enter を押してください...')
  })

  // セッションファイルを保存
  const sessionDir = path.join(__dirname, '..', 'sessions')
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

  const sessionPath = path.join(sessionDir, `${SERVICE}-session.json`)
  await context.storageState({ path: sessionPath })

  await browser.close()

  // base64 エンコード
  const sessionJson = fs.readFileSync(sessionPath, 'utf8')
  const b64 = Buffer.from(sessionJson).toString('base64')
  const b64Path = path.join(sessionDir, `${SERVICE}-session-b64.txt`)
  fs.writeFileSync(b64Path, b64)

  console.log('\n✅ セッションファイルを作成しました！')
  console.log(`\n📋 GitHub Secrets への設定手順:`)
  console.log(`   1. https://github.com/goat-mindmatch/goat-restaurant-os/settings/secrets/actions を開く`)
  console.log(`   2.「New repository secret」をクリック`)
  console.log(`   3. Name: ${config.secret}`)
  console.log(`   4. Value: 以下のコマンドの出力を貼り付け`)
  console.log(`\n   cat ${b64Path}`)
  console.log(`   または:`)
  console.log(`   base64 -i ${sessionPath} | pbcopy  （クリップボードにコピー）`)
  console.log('\n=========================================\n')
}

main().catch(e => {
  console.error('❌ エラー:', e.message)
  process.exit(1)
})
