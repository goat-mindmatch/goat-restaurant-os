#!/usr/bin/env node
/**
 * cloud-rocketnow-sync.js
 * GitHub Actions 上で動作する RocketNow 自動取込スクリプト
 *
 * 必要な環境変数:
 *   ROCKETNOW_SESSION_B64  - セッションJSON を base64 エンコードしたもの
 *   API_URL                - Vercel の本番URL（例: https://goat-restaurant-os.vercel.app）
 *   DISPLAY                - Xvfb のディスプレイ番号（例: :99）← GitHub Actions が自動設定
 *
 * セッション取得方法:
 *   node scripts/setup-delivery-session.js rocketnow
 */

const { chromium } = require('playwright')
const https = require('https')
const http  = require('http')

// ─── 設定 ──────────────────────────────────────────────────
const SESSION_B64  = process.env.ROCKETNOW_SESSION_B64
const API_URL      = process.env.API_URL ?? 'https://goat-restaurant-os.vercel.app'

if (!SESSION_B64) {
  console.error('❌ ROCKETNOW_SESSION_B64 が設定されていません')
  process.exit(1)
}

function log(msg) {
  const ts = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  console.log(`[${ts}] ${msg}`)
}

// ─── API 送信 ───────────────────────────────────────────────
function sendJson(endpoint, data) {
  return new Promise((resolve, reject) => {
    const body    = JSON.stringify(data)
    const url     = new URL(endpoint, API_URL)
    const mod     = url.protocol === 'https:' ? https : http
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }
    const req = mod.request(options, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({ raw: d }) } })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ─── 日付ユーティリティ ──────────────────────────────────────
function jstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// ─── メイン ─────────────────────────────────────────────────
async function main() {
  const storageState = JSON.parse(Buffer.from(SESSION_B64, 'base64').toString('utf8'))
  const today = jstDate(0)
  const yest  = jstDate(-1)

  log('🚀 RocketNow クラウド同期: 開始')
  log(`   今日: ${today}  昨日: ${yest}`)

  const browser = await chromium.launch({
    channel:  'chrome',
    headless: false,
    args:     ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }).catch(async () => {
    log('⚠️ Chrome が見つからないため Chromium で起動します')
    return chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  })

  const context = await browser.newContext({
    storageState,
    locale:    'ja-JP',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // 取得した売上データ蓄積用
  const captured = {}  // { 'YYYY-MM-DD': { orders, sales } }

  // ─── ネットワーク応答を監視 ─────────────────────────────────
  context.on('response', async res => {
    const url = res.url()

    // RocketNow のAPI をキャプチャ
    if (!url.includes('rocketnow')) return
    if (!url.match(/order|sales|report|stat|summary/i)) return

    try {
      const contentType = res.headers()['content-type'] ?? ''
      if (!contentType.includes('application/json')) return
      const json = await res.json()
      parseRocketnowResponse(json, captured)
    } catch {
      // JSON パース失敗は無視
    }
  })

  try {
    // ─── RocketNow パートナーポータルにアクセス ───────────────
    // RocketNow の加盟店管理画面URL（セッション取得時と同じURL）
    const portalUrl = 'https://merchant.rocketnow.jp/'
    await page.goto(portalUrl, {
      waitUntil: 'domcontentloaded',
      timeout:   30000,
    })
    await page.waitForTimeout(3000)

    // ログイン確認
    const currentUrl = page.url()
    if (currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl.includes('auth')) {
      log('❌ RocketNow セッション切れ。Mac で setup-delivery-session.js rocketnow を実行し、ROCKETNOW_SESSION_B64 Secret を更新してください')
      process.exit(2)
    }
    log(`✅ ログイン確認 OK: ${currentUrl}`)

    // ─── 売上・注文レポートページへ移動 ─────────────────────
    const reportUrls = [
      'https://merchant.rocketnow.jp/sales',
      'https://merchant.rocketnow.jp/orders',
      'https://merchant.rocketnow.jp/reports',
      'https://merchant.rocketnow.jp/statistics',
    ]

    for (const url of reportUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(4000)
        log(`📊 ページ移動: ${url}`)
        break
      } catch {
        // 次を試す
      }
    }

    // データが取得できるまで待機
    await page.waitForTimeout(5000)

    // ─── DB保存 ─────────────────────────────────────────────
    const dates = [yest, today]
    let saved = 0

    for (const date of dates) {
      if (!captured[date]) {
        log(`⚠️ ${date} のデータが取得できませんでした`)
        continue
      }
      const { orders, sales } = captured[date]
      log(`🚀 ${date}: ${orders}件 ¥${sales.toLocaleString()}`)

      // CSV形式に変換してAPIに送信
      const csv = `日付,注文数,売上金額\n${date},${orders},${sales}`
      const result = await sendJson('/api/sales/rocketnow-sync', { csv })
      log(`🚀 ${date} DB保存: ${JSON.stringify(result)}`)
      saved++
    }

    if (saved === 0) {
      log('⚠️ データを保存できませんでした。セッションファイルの更新が必要かもしれません。')
      process.exit(3)
    }

    log('✅ RocketNow 同期完了')

  } finally {
    await browser.close()
  }
}

// ─── RocketNow API レスポンスから売上データを抽出 ──────────
function parseRocketnowResponse(json, captured) {
  try {
    // 形式A: { data: [{ date, orderCount, totalAmount }] }
    if (Array.isArray(json?.data)) {
      for (const item of json.data) {
        const date = extractDate(item.date ?? item.orderDate ?? item.day ?? '')
        if (!date) continue
        if (!captured[date]) captured[date] = { orders: 0, sales: 0 }
        captured[date].orders += Number(item.orderCount ?? item.orders ?? item.count ?? 0)
        captured[date].sales  += Math.round(Number(item.totalAmount ?? item.sales ?? item.revenue ?? item.total ?? 0))
      }
      return
    }

    // 形式B: { orders: [{ createdAt, totalPrice }] }
    if (Array.isArray(json?.orders)) {
      for (const order of json.orders) {
        const date = extractDate(order.createdAt ?? order.orderDate ?? order.date ?? '')
        if (!date) continue
        if (!captured[date]) captured[date] = { orders: 0, sales: 0 }
        captured[date].orders++
        captured[date].sales += Math.round(Number(order.totalPrice ?? order.amount ?? order.total ?? 0))
      }
      return
    }

    // 形式C: { date, orders, amount } 単日集計
    if (json?.date) {
      const date = extractDate(String(json.date))
      if (date) {
        captured[date] = {
          orders: Number(json.orders ?? json.orderCount ?? 0),
          sales:  Math.round(Number(json.amount ?? json.total ?? json.sales ?? 0)),
        }
      }
    }
  } catch {
    // パース失敗は無視
  }
}

function extractDate(raw) {
  if (!raw) return null
  const s = String(raw)
  // ISO日付: 2026-04-23
  const m1 = s.match(/(\d{4}-\d{2}-\d{2})/)
  if (m1) return m1[1]
  // スラッシュ: 2026/04/23
  const m2 = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
  // タイムスタンプ
  const ts = Number(s)
  if (!isNaN(ts) && ts > 1e9) {
    const d = new Date((ts < 1e12 ? ts * 1000 : ts) + 9 * 60 * 60 * 1000)
    return d.toISOString().split('T')[0]
  }
  return null
}

main().catch(e => {
  log(`❌ エラー: ${e.message}`)
  console.error(e)
  process.exit(1)
})
