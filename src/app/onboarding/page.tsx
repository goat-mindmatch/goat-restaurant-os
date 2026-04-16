/**
 * 現場導入ガイド（スタッフ・管理者向け操作マニュアル）
 * URL: /onboarding
 * スタッフ研修時に画面を見せながら説明する用
 */

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* ヒーロー */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 pb-12">
        <h1 className="text-3xl font-bold mb-2">🍜 GOAT Restaurant OS</h1>
        <p className="text-blue-100">スタッフ・管理者 使い方ガイド</p>
        <p className="text-xs text-blue-200 mt-2">人類みなまぜそば 向け 運用マニュアル</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-6">
        {/* クイックスタート */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 クイックスタート</h2>

          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">1</div>
              <div>
                <p className="font-semibold text-gray-900">スタッフ用LINEを友だち追加</p>
                <p className="text-gray-600 text-xs mt-1">店舗内に貼ってあるQRコードをLINEで読み取ります</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">2</div>
              <div>
                <p className="font-semibold text-gray-900">自分の名前を送信</p>
                <p className="text-gray-600 text-xs mt-1">「中地」「河野」など名字のみ。自動で登録されます</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">3</div>
              <div>
                <p className="font-semibold text-gray-900">リッチメニューが表示される</p>
                <p className="text-gray-600 text-xs mt-1">出勤・退勤・シフトなど全てここから操作</p>
              </div>
            </div>
          </div>
        </div>

        {/* スタッフ向けメニュー */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">👤 スタッフの使い方</h2>

          <div className="space-y-4">
            <MenuItem icon="🟢" title="出勤ボタン" desc="出勤時にタップするだけで自動打刻。店舗に着いたら即押す習慣に。" />
            <MenuItem icon="🔴" title="退勤ボタン" desc="帰る前にタップ。自動で労働時間・人件費が計算されます。" />
            <MenuItem icon="✏️" title="シフト希望" desc="月末になると翌月の希望提出フォームが届く。他のスタッフの希望日も見えるので、自分で調整可能。" />
            <MenuItem icon="📅" title="シフト確認" desc="確定した自分のシフトを2ヶ月先まで確認。" />
            <MenuItem icon="📦" title="発注依頼" desc="食材などが足りなくなったら、業者ごとに品目・数量を入力して送信。" />
          </div>
        </div>

        {/* 管理者向け */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">👔 管理者（店長）の使い方</h2>

          <div className="space-y-3 text-sm">
            <AdminItem step="朝" title="☀️ AI日報を受信" desc="毎朝8:30、前日の数字を分析したコメントがLINEに届きます。" url="" />
            <AdminItem step="日中" title="💰 売上データ取込" desc="AnyDeliのExcelをアップロード → 自動でFL比率が更新されます。" url="/dashboard/sales" />
            <AdminItem step="随時" title="📦 発注の送付" desc="スタッフからの発注依頼を確認、業者LINEにコピペで送信。" url="/dashboard/orders" />
            <AdminItem step="月末" title="📅 シフト確定" desc="集まった希望を見ながら、日付ごとに誰が入るかを決定。全員にLINE一斉通知。" url="/dashboard/shifts" />
            <AdminItem step="月末" title="💴 給与計算" desc="打刻データから自動計算。CSVダウンロードでExcelへ。" url="/dashboard/payroll" />
            <AdminItem step="随時" title="⭐ 口コミ貢献度" desc="スタッフ別の口コミクリック数ランキング。表彰やインセンティブに活用。" url="/dashboard/reviews" />
          </div>
        </div>

        {/* お客様向け */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🍜 お客様への案内</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>店内POPに顧客用LINEのQRコードを掲示:</p>
            <ul className="space-y-1 pl-4">
              <li>・お会計時「LINEに登録で次回◯%OFF」と声かけ</li>
              <li>・食事後「口コミ書いてもらえると嬉しいです」とリッチメニュー誘導</li>
            </ul>
            <p className="pt-2">お客様が LINE → 「⭐口コミを書く」を押すと：</p>
            <ol className="space-y-1 pl-4 list-decimal">
              <li>今日の担当スタッフを選択</li>
              <li>Google マップの口コミ画面に自動遷移</li>
              <li>スタッフ貢献度が記録される</li>
            </ol>
          </div>
        </div>

        {/* トラブル対応 */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-bold text-amber-900 mb-3">⚠️ よくあるトラブル</h2>
          <div className="space-y-3 text-sm text-amber-800">
            <div>
              <p className="font-semibold">Q. 出勤ボタンを押しても反応がない</p>
              <p className="text-xs">→ 名前登録が終わっていない可能性。自分の名字を送信してください。</p>
            </div>
            <div>
              <p className="font-semibold">Q. シフトのフォームが開けない</p>
              <p className="text-xs">→ LINE内ブラウザで開くか、「Safariで開く」を試してください。</p>
            </div>
            <div>
              <p className="font-semibold">Q. 退勤打刻を忘れた</p>
              <p className="text-xs">→ 管理画面から手動修正可能（今後機能追加予定）。店長に連絡を。</p>
            </div>
          </div>
        </div>

        {/* 管理画面へのリンク */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-300 mb-3">管理画面はこちら</p>
          <a href="/dashboard" className="inline-block bg-white text-gray-900 font-bold px-8 py-3 rounded-xl">
            → 管理ダッシュボードを開く
          </a>
        </div>
      </div>
    </main>
  )
}

function MenuItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-3xl">{icon}</span>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

function AdminItem({ step, title, desc, url }: { step: string; title: string; desc: string; url: string }) {
  const content = (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded h-6">{step}</span>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
      </div>
      {url && <span className="text-gray-400">›</span>}
    </div>
  )
  return url ? <a href={url}>{content}</a> : content
}
