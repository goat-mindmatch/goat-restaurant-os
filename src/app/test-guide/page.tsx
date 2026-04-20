/**
 * テスト・操作ガイド
 * https://goat-restaurant-os.vercel.app/test-guide
 * 認証不要・誰でも閲覧可能
 */
export default function TestGuidePage() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GOAT Restaurant OS — テスト操作ガイド v2</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, 'Hiragino Sans', sans-serif; background: #f8f8f8; color: #1a1a1a; }
          .hero { background: linear-gradient(135deg, #ea580c, #dc2626); color: #fff; padding: 40px 24px 32px; text-align: center; }
          .hero h1 { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
          .hero p { font-size: 14px; opacity: 0.85; margin-top: 8px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.25); border-radius: 999px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-top: 12px; }
          .toc { background: #fff; margin: 16px; border-radius: 16px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
          .toc h2 { font-size: 13px; color: #999; font-weight: 700; margin-bottom: 12px; letter-spacing: 0.5px; }
          .toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .toc-item { background: #f8f8f8; border-radius: 10px; padding: 10px 12px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; display: flex; align-items: center; gap: 6px; }
          .toc-item:hover { background: #fff3ee; color: #ea580c; }
          .section { margin: 0 16px 20px; }
          .card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; }
          .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid #f0f0f0; padding-bottom: 14px; }
          .card-icon { font-size: 28px; }
          .card-title { font-size: 18px; font-weight: 800; }
          .card-sub { font-size: 12px; color: #999; margin-top: 2px; }
          .url-box { background: #1a1a1a; color: #4ade80; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: monospace; margin: 12px 0; word-break: break-all; }
          .url-box span { color: #999; font-size: 11px; display: block; margin-bottom: 4px; }
          .steps { counter-reset: step; }
          .step { display: flex; gap: 12px; margin-bottom: 14px; align-items: flex-start; }
          .step-num { background: #ea580c; color: #fff; font-size: 12px; font-weight: 800; min-width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
          .step-body { flex: 1; }
          .step-body strong { font-size: 14px; display: block; margin-bottom: 4px; }
          .step-body p { font-size: 13px; color: #666; line-height: 1.6; }
          .tip { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #166534; margin-top: 12px; }
          .warn { background: #fefce8; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #854d0e; margin-top: 12px; }
          .tag { display: inline-block; background: #ea580c; color: #fff; font-size: 10px; font-weight: 700; border-radius: 999px; padding: 2px 8px; margin-left: 6px; vertical-align: middle; }
          .tag.blue { background: #2563eb; }
          .tag.green { background: #16a34a; }
          .tag.purple { background: #7c3aed; }
          .section-title { font-size: 12px; font-weight: 700; color: #ea580c; letter-spacing: 1px; text-transform: uppercase; margin: 24px 0 10px; }
          .check { color: #16a34a; font-weight: 700; }
          .img-mock { background: linear-gradient(135deg, #f0f0f0, #e8e8e8); border-radius: 12px; padding: 20px; text-align: center; color: #999; font-size: 13px; margin: 12px 0; border: 2px dashed #ddd; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th { background: #f8f8f8; padding: 8px 10px; text-align: left; font-size: 12px; color: #666; }
          td { padding: 8px 10px; border-top: 1px solid #f0f0f0; }
          .footer { text-align: center; padding: 32px 16px; color: #999; font-size: 12px; }
          @media (max-width: 480px) { .toc-grid { grid-template-columns: 1fr; } }
        `}</style>
      </head>
      <body>

        {/* ヒーロー */}
        <div className="hero">
          <div className="card-icon" style={{fontSize:'40px',marginBottom:'12px'}}>🍜</div>
          <h1>GOAT Restaurant OS<br />テスト・操作ガイド</h1>
          <p>新機能11個の確認方法をまとめました</p>
          <div className="badge">v1: 2026-04-20 / v2: 2026-04-20 追加11機能</div>
        </div>

        {/* 目次 */}
        <div className="toc">
          <h2>📋 目次</h2>
          <div className="toc-grid">
            {[
              ['⚔️', 'スタッフRPG', '#rpg'],
              ['📋', '仕込みタスク', '#tasks'],
              ['🙋', 'テーブル呼び出し', '#call'],
              ['🌟', '退勤ハイライトLINE', '#highlight'],
              ['🎯', '今日のミッションLINE', '#mission'],
              ['🎁', 'ロイヤルティ管理', '#loyalty'],
              ['🧮', 'AIメニュー分析', '#menu-eng'],
              ['🔮', '混雑予測AI', '#forecast'],
              ['📱', 'SNS投稿管理', '#sns'],
              ['📊', '週次AIレポート', '#weekly'],
              ['🤖', 'AI店長モード', '#ai-manager'],
              ['💴', '給与明細LINE送信', '#payslip'],
              ['📅', 'シフトFlex表示', '#shift-flex'],
              ['🌙', '閉店自動日報LINE', '#daily-report'],
              ['🏠', 'ホーム刷新', '#home-new'],
              ['🔔', 'PWAプッシュ通知', '#pwa'],
              ['🗺️', 'テーブルマップUI', '#table-map'],
              ['🌓', 'ダークモード', '#dark'],
              ['🌤️', '天気連動バナー', '#weather'],
              ['🤖', 'AIシフト自動作成', '#shift-ai'],
              ['📦', '在庫自動発注', '#auto-order'],
              ['🌐', '多言語自動翻訳', '#translate'],
              ['🛵', 'Uber Eats自動取込', '#uber'],
            ].map(([icon, label, href]) => (
              <a key={href as string} href={href as string} className="toc-item">
                <span>{icon}</span>{label}
              </a>
            ))}
          </div>
        </div>

        <div className="section">
          <p className="section-title">管理者ダッシュボード</p>

          {/* ① RPG */}
          <div className="card" id="rpg">
            <div className="card-header">
              <div className="card-icon">⚔️</div>
              <div>
                <div className="card-title">スタッフRPGシステム</div>
                <div className="card-sub">勤怠・口コミからEXP・レベルを自動計算</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/rpg
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>ページを開く</strong>
                  <p>「もっと」→「スタッフRPG ⚔️」をタップ</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>確認ポイント</strong>
                  <p>スタッフ全員がランキング形式で表示される。レベル・称号・EXPバー・バッジが出ていればOK</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>EXPの計算式</strong>
                  <p>勤務1日 = 50EXP ／ 口コミ獲得1件 = 150EXP ／ 1000EXPでレベルアップ</p>
                </div>
              </div>
            </div>
            <div className="tip">✅ 称号は「駆け出しスタッフ → ホールの新星 → 接客の達人 → 伝説のスタッフ → 人類みなまぜそば之神」の順で上がります</div>
          </div>

          {/* ② タスク */}
          <div className="card" id="tasks">
            <div className="card-header">
              <div className="card-icon">📋</div>
              <div>
                <div className="card-title">仕込みタスク管理</div>
                <div className="card-sub">開店前・営業中・閉店後のチェックリスト</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/tasks
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>「もっと」→「仕込みタスク」を開く</strong>
                  <p>「開店前 / 営業中 / 閉店後」の3タブが表示される</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>タスクを追加する</strong>
                  <p>右上「＋ タスク追加」→ タスク名・タイミングを入力 → 「登録」</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>チェックをつける</strong>
                  <p>タスクをタップするとチェックが入り、完了率バーが更新される</p>
                </div>
              </div>
            </div>
            <div className="warn">⚠️ 初回はタスクが空です。「＋ タスク追加」から店舗のタスクを登録してください</div>
          </div>

          {/* ③ テーブル呼び出し */}
          <div className="card" id="call">
            <div className="card-header">
              <div className="card-icon">🙋</div>
              <div>
                <div className="card-title">テーブルQRスタッフ呼び出し</div>
                <div className="card-sub">お客様がQRからスタッフを呼べる</div>
              </div>
            </div>
            <div className="url-box">
              <span>お客様側 URL（テーブルQRコードのリンク先）</span>
              https://goat-restaurant-os.vercel.app/menu?table=1
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>お客様側でメニューページを開く</strong>
                  <p>上のURLをスマホで開く（テーブル番号は ?table=1 の数字で変える）</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>ページ下部のボタンをタップ</strong>
                  <p>「🙋 スタッフを呼ぶ」「💧 お水をください」「💳 お会計をお願いします」の3ボタンがある</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>管理側で通知を確認</strong>
                  <p>テーブル管理画面（/dashboard/tables）を開くと、赤いバナーで呼び出し通知が出る。「対応済み」を押すと消える</p>
                </div>
              </div>
            </div>
            <div className="tip">✅ 30秒ごとに自動更新されます。手動で更新しなくてもOK</div>
          </div>

          {/* ④ 退勤ハイライト */}
          <div className="card" id="highlight">
            <div className="card-header">
              <div className="card-icon">🌟</div>
              <div>
                <div className="card-title">退勤後ハイライトLINE</div>
                <div className="card-sub">退勤打刻と同時にLINEへ自動送信</div>
              </div>
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>スタッフLINEで「退勤」と送る</strong>
                  <p>スタッフ用LINE公式アカウントに「退勤」とテキスト送信する</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>自動でFlex Messageが届く</strong>
                  <p>勤務時間・担当テーブル数・今日の口コミ数・今月のEXP・レベルが青いカードで届く</p>
                </div>
              </div>
            </div>
            <div className="tip">✅ スタッフのLINEに line_user_id が登録されていることが条件です（スタッフ管理画面で確認）</div>
          </div>

          {/* ⑤ 今日のミッション */}
          <div className="card" id="mission">
            <div className="card-header">
              <div className="card-icon">🎯</div>
              <div>
                <div className="card-title">今日のミッションLINE</div>
                <div className="card-sub">出勤スタッフ全員に目標をFlex Messageで一斉送信</div>
              </div>
            </div>
            <div className="url-box">
              <span>手動で送信するAPI（ブラウザから叩けます）</span>
              https://goat-restaurant-os.vercel.app/api/line/send-mission
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>上のURLにPOSTリクエストを送る</strong>
                  <p>ブラウザからは送れないため、スマホのアプリ「Hoppscotch」や「API Tester」でPOSTしてください（Body不要）</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>出勤中スタッフのLINEを確認</strong>
                  <p>目標売上・進捗バー・口コミランキングTOP3が届いていればOK</p>
                </div>
              </div>
            </div>
            <div className="warn">⚠️ 本番運用では毎朝9時にcronで自動送信されるよう設定するのがおすすめです</div>
          </div>

          {/* ⑥ ロイヤルティ */}
          <div className="card" id="loyalty">
            <div className="card-header">
              <div className="card-icon">🎁</div>
              <div>
                <div className="card-title">お客様ロイヤルティ管理</div>
                <div className="card-sub">LINE会員のポイント・ランク・クーポン送信</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/loyalty
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>「もっと」→「ロイヤルティ 🎁」を開く</strong>
                  <p>会員数・総ポイント・平均来店回数のサマリーが表示される</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>ランク制度を確認</strong>
                  <p>レギュラー → シルバー（500pt） → ゴールド（2000pt） → プラチナ（5000pt）</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>クーポン送信をテスト</strong>
                  <p>会員カードの「クーポンをLINE送信」を押すと、¥300OFFクーポンがそのお客様のLINEに届く</p>
                </div>
              </div>
            </div>
            <div className="tip">✅ お客様がLINE公式アカウントを友だち追加すると、自動でこの一覧に表示されます</div>
          </div>

          {/* ⑦ メニューエンジニアリング */}
          <div className="card" id="menu-eng">
            <div className="card-header">
              <div className="card-icon">🧮</div>
              <div>
                <div className="card-title">AIメニューエンジニアリング</div>
                <div className="card-sub">注文データから売れ筋・廃盤候補を自動分析</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/menu-engineering
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>「もっと」→「メニュー分析 🧮」を開く</strong>
                  <p>⭐スター / 🐄プラウホース / ❓パズル / 🐕ドッグ の4タブが表示される</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>各タブで内容を確認</strong>
                  <p>スター＝人気かつ高利益、ドッグ＝廃盤候補として表示される</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>「🤖 AI分析を依頼」ボタンを押す</strong>
                  <p>AIが日本語でメニュー改善の提案コメントを生成して表示する</p>
                </div>
              </div>
            </div>
            <table>
              <thead><tr><th>記号</th><th>意味</th><th>推奨アクション</th></tr></thead>
              <tbody>
                <tr><td>⭐ スター</td><td>人気・高利益</td><td>もっと推す・看板メニュー化</td></tr>
                <tr><td>🐄 プラウホース</td><td>人気・低利益</td><td>価格見直し or 原価改善</td></tr>
                <tr><td>❓ パズル</td><td>不人気・高利益</td><td>SNSで告知・写真改善</td></tr>
                <tr><td>🐕 ドッグ</td><td>不人気・低利益</td><td>廃盤候補・メニュー整理</td></tr>
              </tbody>
            </table>
          </div>

          {/* ⑧ 混雑予測 */}
          <div className="card" id="forecast">
            <div className="card-header">
              <div className="card-icon">🔮</div>
              <div>
                <div className="card-title">混雑予測シフトAI</div>
                <div className="card-sub">来週の売上・必要スタッフ数を曜日別に予測</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/forecast
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>「もっと」→「混雑予測 🔮」を開く</strong>
                  <p>来週7日分の予測売上が棒グラフで表示される</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>必要スタッフ数を確認</strong>
                  <p>各日の下に「スタッフ目安：〇人」が表示される（売上¥3万/人/日で計算）</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>AIコメントを確認</strong>
                  <p>「なぜ木曜が多いのか」など、AIが過去データをもとに解説する</p>
                </div>
              </div>
            </div>
            <div className="tip">✅ 売上データが蓄積されるほど予測精度が上がります。月次でチェックするのがおすすめ</div>
          </div>

          {/* ⑨ SNS */}
          <div className="card" id="sns">
            <div className="card-header">
              <div className="card-icon">📱</div>
              <div>
                <div className="card-title">SNS自動投稿管理</div>
                <div className="card-sub">AIキャプション生成 → Instagram/TikTok/X投稿予約</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/sns
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>「＋ 新規投稿を作成」をタップ</strong>
                  <p>メニュー名・価格・説明を入力する</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>「🤖 AIキャプション生成」を押す</strong>
                  <p>AIが投稿文とハッシュタグを自動で作成する（例：#まぜそば #渋谷グルメ など）</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-body">
                  <strong>プラットフォームを選んで保存</strong>
                  <p>Instagram・TikTok・Xにチェックを入れて「保存」→「予約済み」タブに表示される</p>
                </div>
              </div>
            </div>
            <div className="warn">⚠️ 現在は「投稿予約の保存」まで動作します。実際のSNSへの自動送信はInstagram/TikTok APIの審査通過後に有効になります</div>
          </div>

          {/* ⑩ 週次AIレポート */}
          <div className="card" id="weekly">
            <div className="card-header">
              <div className="card-icon">📊</div>
              <div>
                <div className="card-title">週次AIレポートLINE</div>
                <div className="card-sub">毎週月曜、経営まとめをAIが分析してLINE送信</div>
              </div>
            </div>
            <div className="url-box">
              <span>手動で今すぐ送信するURL（GETでOK）</span>
              https://goat-restaurant-os.vercel.app/api/reports/weekly?secret=【CRON_SECRET】
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>上のURLのCRON_SECRETを実際の値に置き換えてブラウザで開く</strong>
                  <p>CRON_SECRETはVercelの環境変数に設定してある値です（谷手さんが管理）</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>managerロールのスタッフのLINEを確認</strong>
                  <p>先週の売上・人気Top3・MVP・AIコメントが届いていればOK</p>
                </div>
              </div>
            </div>
            <div className="tip">✅ 本番運用では毎週月曜7:00にcronが自動実行されます</div>
          </div>

          {/* ⑪ AI店長 */}
          <div className="card" id="ai-manager">
            <div className="card-header">
              <div className="card-icon">🤖</div>
              <div>
                <div className="card-title">AI店長モード</div>
                <div className="card-sub">売上急落・人件費超過・呼び出し放置を自動検知</div>
              </div>
            </div>
            <div className="url-box">
              <span>手動でチェックするURL（GETでOK）</span>
              https://goat-restaurant-os.vercel.app/api/ai-manager/check?secret=【CRON_SECRET】
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-body">
                  <strong>上のURLをブラウザで開く</strong>
                  <p>アラートの検知結果がJSONで表示される</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-body">
                  <strong>アラートが検知された場合</strong>
                  <p>managerロールのスタッフのLINEに自動通知が届く</p>
                </div>
              </div>
            </div>
            <table>
              <thead><tr><th>アラートの種類</th><th>発動条件</th></tr></thead>
              <tbody>
                <tr><td>📉 売上急落</td><td>当日売上が先週同曜日比50%以下</td></tr>
                <tr><td>💸 人件費超過</td><td>今月の人件費率が40%超</td></tr>
                <tr><td>📣 呼び出し放置</td><td>テーブル呼び出しが10分以上未対応</td></tr>
                <tr><td>⭐ 口コミ急増</td><td>当日の口コミが5件以上</td></tr>
              </tbody>
            </table>
            <div className="tip">✅ 本番運用では1時間おきにcronが自動実行されます</div>
          </div>

        </div>

        <div className="section">
          {/* ═══════ v2 新機能セクション ═══════ */}
          <p className="section-title" style={{marginTop:'8px'}}>🆕 v2 追加機能（2026-04-20）</p>

          {/* 給与明細LINE */}
          <div className="card" id="payslip">
            <div className="card-header">
              <div className="card-icon">💴</div>
              <div>
                <div className="card-title">給与明細LINE自動送信</div>
                <div className="card-sub">月末25日にスタッフのLINEへ自動配信</div>
              </div>
            </div>
            <div className="url-box">
              <span>手動で今すぐ送信するURL</span>
              https://goat-restaurant-os.vercel.app/api/payroll/send-slip?month=2026-04&secret=【CRON_SECRET】
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>上のURLのCRON_SECRETと月を指定してブラウザで開く</strong><p>月は YYYY-MM 形式で指定</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>スタッフのLINEを確認</strong><p>紺色ヘッダーの給与明細Flex Messageが届いていればOK。「受領確認」ボタンも表示される</p></div></div>
            </div>
            <div className="tip">✅ 対象: staff テーブルに line_user_id が登録されている全アクティブスタッフ</div>
          </div>

          {/* シフトFlex */}
          <div className="card" id="shift-flex">
            <div className="card-header">
              <div className="card-icon">📅</div>
              <div>
                <div className="card-title">シフトFlex Message（LINE内カレンダー）</div>
                <div className="card-sub">「シフト確認」でLINE内にカレンダーが展開</div>
              </div>
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>スタッフLINEで「シフト確認」と送信</strong><p>これまでURLリンクが来ていたが、今後はLINE内で直接カレンダーが表示される</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>確認ポイント</strong><p>オレンジ背景●=出勤予定日、グレー背景○=休み、今日の日付は太字で表示</p></div></div>
            </div>
          </div>

          {/* 閉店日報 */}
          <div className="card" id="daily-report">
            <div className="card-header">
              <div className="card-icon">🌙</div>
              <div>
                <div className="card-title">閉店自動日報LINE送信</div>
                <div className="card-sub">毎日23:00にmanager/ownerロールのLINEへ自動送信</div>
              </div>
            </div>
            <div className="url-box">
              <span>手動で今すぐ送信するURL</span>
              https://goat-restaurant-os.vercel.app/api/line/daily-report?secret=【CRON_SECRET】
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>上のURLをブラウザで開く</strong><p>manager/ownerロールのスタッフのLINEに今日の日報が届く</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>確認ポイント</strong><p>売上合計・客数・口コミランキング・先週比・目標達成率が黒いカードで届いていればOK</p></div></div>
            </div>
            <div className="tip">✅ スタッフのroleが'manager'または'owner'で、line_user_idが登録されていることが条件</div>
          </div>

          {/* ホーム刷新 */}
          <div className="card" id="home-new">
            <div className="card-header">
              <div className="card-icon">🏠</div>
              <div>
                <div className="card-title">ホーム画面 — コントロールパネル刷新</div>
                <div className="card-sub">今日の全情報が1画面で把握できる設計に</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>ダッシュボードを開く</strong><p>店舗名・営業中バッジ・売上プログレスバーが最上部に表示される</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>確認ポイント</strong><p>テーブル空席数・未対応呼び出し件数（赤点滅）・今日の口コミランキング・天気バナーが全部1画面で見える</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-body"><strong>30秒自動更新</strong><p>画面を触らなくてもデータが30秒ごとに自動更新される</p></div></div>
            </div>
          </div>

          {/* PWA */}
          <div className="card" id="pwa">
            <div className="card-header">
              <div className="card-icon">🔔</div>
              <div>
                <div className="card-title">PWAプッシュ通知</div>
                <div className="card-sub">ホーム画面に追加してロック画面でも通知受信</div>
              </div>
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>ダッシュボードをスマホで開く</strong><p>Safariの場合「共有」→「ホーム画面に追加」でアプリとして使えるようになる</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>「🔔 通知をON」ボタンをタップ</strong><p>ホーム画面の右上に表示。タップすると通知許可ダイアログが出る</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-body"><strong>「許可」をタップ</strong><p>以後、テーブル呼び出しやアラートがロック画面に通知される</p></div></div>
            </div>
          </div>

          {/* テーブルマップ */}
          <div className="card" id="table-map">
            <div className="card-header">
              <div className="card-icon">🗺️</div>
              <div>
                <div className="card-title">テーブル管理 フロアマップUI</div>
                <div className="card-sub">カード一覧に加え、フロア見取り図で確認できる</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/tables
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>「🗺️ マップ表示」タブをタップ</strong><p>テーブルがグリッド形式でフロアマップ風に表示される</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>色の意味</strong><p>グレー=空き、赤=注文中、黄=会計待ち。タップすると注文詳細が開く</p></div></div>
            </div>
          </div>

          {/* ダークモード */}
          <div className="card" id="dark">
            <div className="card-header">
              <div className="card-icon">🌓</div>
              <div>
                <div className="card-title">ダークモード</div>
                <div className="card-sub">夜の厨房でも眩しくない暗い画面に切替</div>
              </div>
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>「もっと」→「設定 ⚙️」を開く</strong><p>「表示設定」セクションにダークモードのトグルがある</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>トグルをONにする</strong><p>即座に画面全体が暗いテーマに切り替わる。設定は次回以降も保持される</p></div></div>
            </div>
            <div className="tip">✅ スマホのシステム設定（ダークモード）にも自動連動します</div>
          </div>

          {/* 天気バナー */}
          <div className="card" id="weather">
            <div className="card-header">
              <div className="card-icon">🌤️</div>
              <div>
                <div className="card-title">天気連動バナー</div>
                <div className="card-sub">今日の天気に合わせた運営アドバイスを表示</div>
              </div>
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>ダッシュボードホームを開く</strong><p>売上カードの下に天気バナーが自動表示される</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>天気に応じたメッセージ</strong><p>☀️晴れ→テラス席案内、☔雨→Uber Eats確認、❄️雪→スタッフ配置見直し など</p></div></div>
            </div>
          </div>

          {/* シフトAI */}
          <div className="card" id="shift-ai">
            <div className="card-header">
              <div className="card-icon">🤖</div>
              <div>
                <div className="card-title">AIシフト自動作成</div>
                <div className="card-sub">希望日・混雑予測から自動でシフト案を生成</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/shifts/auto
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>「もっと」→「AIシフト 🤖」を開く</strong><p>対象年月を選択する</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>「🤖 AIシフトを生成」をタップ</strong><p>スタッフの希望日・曜日別混雑を考慮してシフト案が自動生成される（10〜20秒かかる）</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-body"><strong>内容を確認して「このシフトを確定する」をタップ</strong><p>shiftsテーブルに一括登録される</p></div></div>
            </div>
            <div className="warn">⚠️ AIが生成したシフトは必ず人間が確認してから確定してください</div>
          </div>

          {/* 在庫自動発注 */}
          <div className="card" id="auto-order">
            <div className="card-header">
              <div className="card-icon">📦</div>
              <div>
                <div className="card-title">在庫 → 自動発注メール</div>
                <div className="card-sub">最低在庫を下回ったら業者に自動メール送信</div>
              </div>
            </div>
            <div className="url-box">
              <span>手動で今すぐ実行するURL</span>
              https://goat-restaurant-os.vercel.app/api/inventory/auto-order?secret=【CRON_SECRET】
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>在庫管理画面で発注設定を行う</strong><p>「もっと」→「在庫管理」→ 各アイテムの「⚡」ボタンをタップ → 最低在庫数・発注先メールアドレスを設定</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>在庫が閾値を下回ったら自動メール送信</strong><p>毎日1回cronが実行。発注先メールアドレスに自動でメールが届く</p></div></div>
            </div>
            <div className="tip">✅ 発注先メールアドレスが未設定のアイテムは自動発注されません</div>
          </div>

          {/* 多言語翻訳 */}
          <div className="card" id="translate">
            <div className="card-header">
              <div className="card-icon">🌐</div>
              <div>
                <div className="card-title">多言語メニュー自動翻訳</div>
                <div className="card-sub">AIが英語・中国語を自動生成</div>
              </div>
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>「もっと」→「メニュー管理」→ 編集したいメニューをタップ</strong><p>編集フォームが開く</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>「🌐 AI翻訳を自動生成」ボタンをタップ</strong><p>日本語のメニュー名・説明からAIが英語・中国語を自動生成</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-body"><strong>内容を確認して保存</strong><p>お客様のQRメニューで英語・中国語が表示されるようになる（言語切替ボタンから選択）</p></div></div>
            </div>
          </div>

          {/* Uber Eats */}
          <div className="card" id="uber">
            <div className="card-header">
              <div className="card-icon">🛵</div>
              <div>
                <div className="card-title">Uber Eats 売上取込</div>
                <div className="card-sub">CSVを貼り付けるだけでPLに自動反映</div>
              </div>
            </div>
            <div className="url-box">
              <span>アクセス URL</span>
              https://goat-restaurant-os.vercel.app/dashboard/sales/uber-import
            </div>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-body"><strong>Uber Eatsダッシュボードからレポートを取得</strong><p>「分析」→「注文レポート」→ 対象期間を選んでCSVダウンロード</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-body"><strong>「もっと」→「Uber取込 🛵」を開く</strong><p>CSVの内容をテキストボックスに貼り付ける</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-body"><strong>「取込実行」をタップ</strong><p>「〇日分のUber Eats売上を反映しました」と表示されればOK。PLページで確認できる</p></div></div>
            </div>
            <table>
              <thead><tr><th>対応形式</th><th>例</th></tr></thead>
              <tbody>
                <tr><td>YYYY-MM-DD,注文数,売上</td><td>2026-04-01,12,18400</td></tr>
                <tr><td>MM/DD/YYYY,注文数,売上</td><td>04/01/2026,12,18400</td></tr>
                <tr><td>英語ヘッダー（Date,Orders,Subtotal）</td><td>そのまま貼り付けOK</td></tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* フッター */}
        <div className="footer">
          <p>🍜 GOAT Restaurant OS — テスト操作ガイド</p>
          <p style={{marginTop:'6px'}}>v1: 2026-04-20（11機能）／ v2: 2026-04-20（+12機能 = 計23機能）</p>
          <p style={{marginTop:'6px'}}>
            <a href="https://goat-restaurant-os.vercel.app/dashboard" style={{color:'#ea580c'}}>
              → ダッシュボードを開く
            </a>
          </p>
        </div>

      </body>
    </html>
  )
}
