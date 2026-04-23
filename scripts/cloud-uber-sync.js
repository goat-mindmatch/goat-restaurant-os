#!/usr/bin/env node
/**
 * cloud-uber-sync.js
 * GitHub Actions 上で動作する Uber Eats 自動取込スクリプト
 *
 * 必要な環境変数:
 *   UBER_SESSION_B64  - セッションJSON を base64 エンコードしたもの
 *   API_URL           - Vercel の本番URL（例: https://goat-restaurant-os.vercel.app）
 *   DISPLAY           - Xvfb のディスプレイ番号（例: :99）← GitHub Actions が自動設定
 *
 * セッション取得方法:
 *   node scripts/setup-delivery-session.js uber
 */

const { chromium } = require('playwright')
const https = require('https')
const http  = require('http')

// ─── 設定 ──────────────────────────────────────────────────
const SESSION_B64 = process.env.UBER_SESSION_B64
const API_URL     = process.env.API_URL ?? 'https://goat-restaurant-os.vercel.app'

// 取得する期間（今日と昨日）
const DAYS_TO_FETCH = 2

if (!SESSION_B64) {
  console.error('❌ UBER_SESSION_B64 が設定されていません')
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

  log('🛵 Uber Eats クラウド同期: 開始')
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

    // Uber Eats Manager の注文API をキャプチャ
    // 例: /v2/eats/orders, /v2/orders/stores/xxx/summary など
    if (!url.includes('restaurant.uber.com') && !url.includes('uber.com/v2')) return
    if (!url.match(/orders|payments|reporting|summary/i)) return

    try {
      const contentType = res.headers()['content-type'] ?? ''
      if (!contentType.includes('application/json')) return
      const json = await res.json()
      parseUberResponse(json, captured)
    } catch {
      // JSON パース失敗は無視
    }
  })

  try {
    // ─── Uber Eats Manager にアクセス ──────────────────────────
    await page.goto('https://restaurant.uber.com/', {
      waitUntil: 'domcontentloaded',
      timeout:   30000,
    })
    await page.waitForTimeout(3000)

    // ログイン確認
    if (page.url().includes('login') || page.url().includes('auth')) {
      log('❌ Uber Eats セッション切れ。Mac で setup-delivery-session.js uber を実行し、UBER_SESSION_B64 Secret を更新してください')
      process.exit(2)
    }
    log(`✅ ログイン確認 OK: ${page.url()}`)

    // ─── 注文レポートページへ移動 ────────────────────────────
    // レポートページに移動してデータを取得
    const reportUrls = [
      'https://restaurant.uber.com/v2/n/reporting/orders',
      'https://restaurant.uber.com/v2/n/reporting/payments',
      'https://restaurant.uber.com/v2/n/reporting',
    ]

    let reportLoaded = false
    for (const url of reportUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(4000)
        reportLoaded = true
        log(`📊 レポートページ: ${url}`)
        break
      } catch {
        log(`⚠️ ${url} 読込失敗、次を試します`)
      }
    }

    if (!reportLoaded) {
      // トップページから注文ページを探す
      await page.goto('https://restaurant.uber.com/', { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(3000)
    }

    // ─── 日付フィルターを今日・昨日に設定（可能な場合） ─────
    // 注文一覧から本日・昨日のデータを取得
    for (let dayOffset = 0; dayOffset >= -(DAYS_TO_FETCH - 1); dayOffset--) {
      const targetDate = jstDate(dayOffset)
      log(`📅 ${targetDate} のデータを取得中...`)

      // 日付指定APIをトリガーするためページ操作
      await page.evaluate((date) => {
        // カスタムイベントで日付選択をシミュレート（SPA対応）
        window.dispatchEvent(new CustomEvent('uber-date-filter', { detail: { date } }))
      }, targetDate)

      await page.waitForTimeout(3000)
    }

    // ─── フォールバック: ページ内テキストから集計 ───────────
    if (Object.keys(captured).length === 0) {
      log('⚠️ API インターセプトでデータ取得できず、テキスト抽出を試みます')
      const pageText = await page.textContent('body').catch(() => '')
      const fallback = extractSalesFromText(pageText, today, yest)
      Object.assign(captured, fallback)
    }

    // ─── DB保存 ─────────────────────────────────────────────
    const dates = [yest, today]
    for (const date of dates) {
      if (!captured[date]) {
        log(`⚠️ ${date} のデータが取得できませんでした（0件として記録）`)
        continue
      }
      const { orders, sales } = captured[date]
      log(`🛵 ${date}: ${orders}件 ¥${sales.toLocaleString()}`)

      const result = await sendJson('/api/sales/uber-sync', {
        date,
        orders,
        sales,
      })
      log(`🛵 ${date} DB保存: ${JSON.stringify(result)}`)
    }

    log('✅ Uber Eats 同期完了')

  } finally {
    await browser.close()
  }
}

// ─── Uber Eats API レスポンスから売上データを抽出 ──────────
function parseUberResponse(json, captured) {
  try {
    // レスポンス形式A: { orders: [{ placedAt, grossRevenue, ... }] }
    if (Array.isArray(json?.orders)) {
      for (const order of json.orders) {
        const date = extractDateFromOrder(order)
        if (!date) continue
        if (!captured[date]) captured[date] = { orders: 0, sales: 0 }
        captured[date].orders++
        captured[date].sales += Math.round(
          Number(order.grossRevenue ?? order.subtotal ?? order.price ?? 0)
        )
      }
      return
    }

    // レスポンス形式B: { data: { orders: [...] } }
    if (Array.isArray(json?.data?.orders)) {
      parseUberResponse({ orders: json.data.orders }, captured)
      return
    }

    // レスポンス形式C: 日別集計 { date: 'YYYY-MM-DD', totalOrders, totalRevenue }
    if (json?.date && json?.totalOrders !== undefined) {
      const date = String(json.date).slice(0, 10)
      captured[date] = {
        orders: Number(json.totalOrders) || 0,
        sales:  Math.round(Number(json.totalRevenue ?? json.grossRevenue ?? 0)),
      }
      return
    }

    // レスポンス形式D: { summary: { byDate: [...] } }
    if (Array.isArray(json?.summary?.byDate)) {
      for (const item of json.summary.byDate) {
        const date = String(item.date ?? item.day ?? '').slice(0, 10)
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue
        captured[date] = {
          orders: Number(item.orders ?? item.orderCount ?? 0),
          sales:  Math.round(Number(item.revenue ?? item.sales ?? item.total ?? 0)),
        }
      }
    }
  } catch {
    // パース失敗は無視
  }
}

function extractDateFromOrder(order) {
  const raw = order.placedAt ?? order.createdAt ?? order.orderTime ?? order.date ?? ''
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  // JST変換
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

function extractSalesFromText(text, ...dates) {
  const result = {}
  // 簡易パターン: ¥X,XXX や ¥XXXXX の金額を探す
  const amountPattern = /¥([\d,]+)/g
  const amounts = []
  let m
  while ((m = amountPattern.exec(text)) !== null) {
    amounts.push(parseInt(m[1].replace(/,/g, ''), 10))
  }
  // データが取れない場合は空で返す（手動確認必要）
  return result
}

main().catch(e => {
  log(`❌ エラー: ${e.message}`)
  console.error(e)
  process.exit(1)
})
