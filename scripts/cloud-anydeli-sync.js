#!/usr/bin/env node
/**
 * cloud-anydeli-sync.js
 * GitHub Actions 上で動作する AnyDeli 自動取込スクリプト
 *
 * 必要な環境変数:
 *   ANYDELI_SESSION_B64  - セッションJSON を base64 エンコードしたもの
 *   API_URL              - Vercel の本番URL（例: https://goat-restaurant-os.vercel.app）
 *   DISPLAY              - Xvfb のディスプレイ番号（例: :99）← GitHub Actions が自動設定
 */

const { chromium } = require('playwright')
const https = require('https')
const http  = require('http')

// ─── 設定 ──────────────────────────────────────────────────
const SESSION_B64 = process.env.ANYDELI_SESSION_B64
const API_URL     = process.env.API_URL ?? 'https://goat-restaurant-os.vercel.app'

if (!SESSION_B64) {
  console.error('❌ ANYDELI_SESSION_B64 が設定されていません')
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
function jstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}
function jstYesterday() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

// ─── メイン ─────────────────────────────────────────────────
async function main() {
  const storageState = JSON.parse(Buffer.from(SESSION_B64, 'base64').toString('utf8'))

  const today = jstToday()
  const yest  = jstYesterday()
  const month = today.slice(0, 7) // YYYY-MM

  log('🍱 AnyDeli クラウド同期: 開始')
  log(`   今日: ${today}  昨日: ${yest}`)

  // Chrome を起動（GitHub Actions では Xvfb 経由で headless: false も動く）
  const browser = await chromium.launch({
    channel:  'chrome',
    headless: false,
    args:     ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }).catch(async () => {
    // Chrome が見つからない場合は Playwright Chromium にフォールバック
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

  try {
    // セッション確認
    await page.goto('https://shop.anydeli.co.jp/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    if (page.url().includes('login')) {
      log('❌ AnyDeli セッション切れ。Mac で setup-delivery-session.js anydeli を実行し、Secretを更新してください')
      process.exit(2) // exit code 2 = セッション切れ（Actions で識別用）
    }

    log(`✅ ログイン確認 OK`)

    // ─── asset/statistics 取得ヘルパー ──────────────────────
    async function fetchStats(targetDate) {
      return new Promise(async resolve => {
        let captured = null
        const h = async res => {
          if (!res.url().includes('/api/client/asset/statistics')) return
          try { captured = JSON.parse(await res.text()); context.off('response', h) } catch {}
        }
        context.on('response', h)
        await context.unroute('**/api/client/asset/statistics').catch(() => {})
        await context.route('**/api/client/asset/statistics', async route => {
          await route.continue({ postData: JSON.stringify({ cost_type: 0, time: targetDate }) })
        })
        await page.goto('https://shop.anydeli.co.jp/main/asset/totalSales', {
          waitUntil: 'domcontentloaded', timeout: 20000,
        })
        await page.waitForTimeout(3000)
        context.off('response', h)
        resolve(captured)
      })
    }

    // 昨日・今日のデータ取得
    const yestStats  = await fetchStats(yest)
    const todayStats = await fetchStats(today)

    // ─── asset/bill で現金/オンライン内訳を取得 ─────────────
    const billResult = await new Promise(async resolve => {
      let captured = null
      const h = async res => {
        if (!res.url().includes('/api/client/asset/bill')) return
        try { captured = JSON.parse(await res.text()); context.off('response', h) } catch {}
      }
      context.on('response', h)
      await context.unroute('**/api/client/asset/statistics').catch(() => {})
      await context.route('**/api/client/asset/bill', async route => {
        await route.continue({ postData: JSON.stringify({ type: '1', time: month }) })
      })
      await page.goto('https://shop.anydeli.co.jp/main/asset/zhangddz', {
        waitUntil: 'domcontentloaded', timeout: 20000,
      })
      await page.waitForTimeout(3000)
      context.off('response', h)
      resolve(captured)
    })

    const billList = billResult?.code === 200 ? (billResult.data?.list || []) : []

    // ─── 集計 ───────────────────────────────────────────────
    function sumStats(statsData) {
      if (!statsData || statsData.code !== 200) return { orders: 0, sales: 0 }
      const s = statsData.data?.stats || []
      return {
        orders: s.reduce((a, h) => a + (Number(h.num)     || 0), 0),
        sales:  Math.round(s.reduce((a, h) => a + (Number(h.allcost) || 0), 0)),
      }
    }

    function getBillBreakdown(date, totalSales) {
      const row = billList.find(r => r.time === date)
      if (!row) return { cash: null, online: null }
      const online = Math.round(
        (Number(row.credit) || 0) + (Number(row.paypay) || 0) +
        (Number(row.alipay) || 0) + (Number(row.wechat) || 0)
      )
      const cash = Math.max(0, totalSales - online)
      return { cash, online }
    }

    const yestTotals  = sumStats(yestStats)
    const todayTotals = sumStats(todayStats)
    const yestBill    = getBillBreakdown(yest,  yestTotals.sales)
    const todayBill   = getBillBreakdown(today, todayTotals.sales)

    log(`🍱 昨日(${yest}): ${yestTotals.orders}件 ¥${yestTotals.sales.toLocaleString()} 現金¥${yestBill.cash ?? '-'} オンライン¥${yestBill.online ?? '-'}`)
    log(`🍱 今日(${today}): ${todayTotals.orders}件 ¥${todayTotals.sales.toLocaleString()} 現金¥${todayBill.cash ?? '-'} オンライン¥${todayBill.online ?? '-'}`)

    // DB 保存
    const r1 = await sendJson('/api/sales/anydeli-sync', {
      date: yest, orders: yestTotals.orders, sales: yestTotals.sales,
      cash_sales: yestBill.cash ?? undefined, online_sales: yestBill.online ?? undefined,
    })
    log(`🍱 昨日 DB保存: ${JSON.stringify(r1)}`)

    const r2 = await sendJson('/api/sales/anydeli-sync', {
      date: today, orders: todayTotals.orders, sales: todayTotals.sales,
      cash_sales: todayBill.cash ?? undefined, online_sales: todayBill.online ?? undefined,
    })
    log(`🍱 今日 DB保存: ${JSON.stringify(r2)}`)

    log('✅ 同期完了')

  } finally {
    await browser.close()
  }
}

main().catch(e => {
  log(`❌ エラー: ${e.message}`)
  console.error(e)
  process.exit(1)
})
