# Stripe Connect 申請・設定マニュアル
## GOAT Restaurant OS — 決済プラットフォーム化ガイド

**作成日：2026-04-20 / 対象：谷手琉加**

---

## このマニュアルでできるようになること

GOATがStripeのプラットフォームとして登録することで、
各飲食店（連携店舗）が自分のアカウントで決済を受け取りながら、
GOATが自動的に「プラットフォーム手数料」を受け取れるようになります。

```
お客様が¥1,000払う
  → Stripe が処理（手数料3.6% = ¥36差し引き）
  → GOATのプラットフォーム手数料（例：1% = ¥10）が自動で分配
  → 飲食店に¥954が振り込まれる
  → GOATに¥10が入金される（自動・毎日）
```

---

## STEP 1：Stripeアカウントを開設する（15分）

### 1-1. Stripeアカウント作成

1. https://stripe.com/jp にアクセス
2. 「今すぐ始める」をクリック
3. 以下を入力して登録：
   - メールアドレス：tanite@goat-groups.com
   - パスワード（任意）
   - 氏名

### 1-2. 本人確認（KYC）を完了させる

登録後、ダッシュボードに「本人確認が必要です」と表示されます。

必要書類：
- [ ] **運転免許証 or マイナンバーカード**（表裏の写真）
- [ ] **銀行口座情報**（GOAT株式会社の法人口座）
  - 銀行名・支店名・口座番号・口座名義

入力する事業情報：
- 事業形態：**法人**（GOAT株式会社）
- 業種：**SaaS・ソフトウェア**（または「飲食業向けサービス」）
- ウェブサイト：https://goat-restaurant-os.vercel.app
- 月間売上見込み：50万円〜100万円（最初は低めでOK）

⏱️ 審査時間：通常即日〜3営業日

---

## STEP 2：Stripe Connect を有効化する（30分）

### 2-1. Connect ダッシュボードを開く

1. Stripeダッシュボードにログイン
2. 左メニュー「Connect」をクリック
3. 「Connect を始める」をクリック

### 2-2. プラットフォームタイプを選択

以下を選択してください：

```
✅ Express アカウント（推奨）
   → 各店舗のKYC（本人確認）をStripeが代行してくれる
   → GOATは「プラットフォーム手数料」を設定するだけ
   → 法的責任が最も少ない
   
❌ Standard アカウント（今回は選ばない）
❌ Custom アカウント（今回は選ばない）
```

### 2-3. プラットフォーム情報を設定

| 項目 | 入力内容 |
|------|---------|
| プラットフォーム名 | GOAT Restaurant OS |
| ウェブサイト | https://goat-restaurant-os.vercel.app |
| サービス説明 | 飲食店向け経営管理SaaS。シフト・給与・売上・決済を一元管理 |
| カテゴリー | SaaS / マーケットプレイス |

### 2-4. 利用規約に同意

「Stripe Connected Account Agreement」を確認して同意。

⏱️ Connect有効化：申請後1〜2週間でGOATに連絡が来ます。

---

## STEP 3：APIキーを取得する（5分）

Connect承認後、以下の2種類のキーを取得します：

### 公開可能キー（Publishable key）
```
pk_live_xxxxxxxxxxxxxxxxxxxxx
```
→ 決済フォームのフロントエンドで使用

### シークレットキー（Secret key）
```
sk_live_xxxxxxxxxxxxxxxxxxxxx
```
→ バックエンドAPIで使用（絶対に公開しない）

### キーの保存場所
`.env.local` ファイルに追記（私の作業）：
```
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## STEP 4：Webhookを設定する（10分）

StripeからGOATシステムに「決済完了」「返金」等のイベントを受け取るための設定です。

1. Stripe ダッシュボード → 「Webhook」
2. 「エンドポイントを追加」
3. URL：`https://goat-restaurant-os.vercel.app/api/stripe/webhook`
4. リッスンするイベントを選択：
   - `payment_intent.succeeded`（決済成功）
   - `payment_intent.payment_failed`（決済失敗）
   - `account.updated`（連携店舗の情報更新）
   - `transfer.created`（送金完了）
5. 「Signing secret」をコピーして保存

---

## STEP 5：各店舗のオンボーディングフロー（実装済み後）

GOATシステムが完成したら、各飲食店はこの流れでConnect登録します：

```
1. GOAT担当者が管理画面で「店舗を追加」
2. システムが「Stripeアカウント連携リンク」を自動生成
3. リンクをメールで店舗オーナーに送付
4. 店舗オーナーがリンクをクリック → Stripe Express登録（約10分）
5. 登録完了 → 翌日から決済受取可能
```

店舗側に必要なもの：
- 法人/個人事業主の本人確認書類
- 銀行口座（売上振込先）
- メールアドレス

---

## プラットフォーム手数料の設定例

実装後、以下の設定が可能です：

### パターンA：決済額に対して%課金
```
お客様：¥1,000
Stripe手数料：¥36（3.6%）
GOATプラットフォーム手数料：¥10（1.0%）
店舗受取：¥954
```

### パターンB：月額SaaS＋低率手数料（推奨）
```
SaaS月額：¥15,000/月（固定収益）
プラットフォーム手数料：0.5%（変動収益）
→ 月売上¥300万の店舗で：¥15,000 + ¥15,000 = ¥30,000/月/店
```

---

## よくある質問

**Q: Stripeに追加の金融ライセンスは必要？**
A: 不要です。StripeはすでにJapanで資金移動業者として登録済みです。GOATはStripeのプラットフォーム機能を使うだけなので、Stripeのライセンス傘下で動きます。

**Q: 各店舗は別途Stripeアカウントを持つ必要がある？**
A: Stripe Expressを使うと、GOAT経由でStripeが自動的に作成します。店舗側の手続きは10分程度です。

**Q: 審査に落ちることはある？**
A: ウェブサイトが存在し、事業内容が明確であれば通常審査通過します。「飲食店向けSaaS」は高リスク業種ではありません。

**Q: テスト環境はある？**
A: はい。Stripeには本番環境とは別に「テストモード」があります。実際に開発・テスト中は全てテストモードで動かします。

---

## 次のアクション チェックリスト

### 琉加さん（今すぐできる）
- [ ] https://stripe.com/jp でアカウント作成
- [ ] 本人確認（運転免許 + 法人口座）を完了
- [ ] Connect申請（プラットフォームタイプ：Express）
- [ ] APIキー（公開可能・シークレット）をコピーしてGOAT Agentに送付

### GOAT Agent（APIキー受領後）
- [ ] `.env.local` にStripeキー追加
- [ ] `/api/stripe/webhook` エンドポイント実装
- [ ] `/api/stripe/onboard` 店舗Connect登録リンク生成API実装
- [ ] テーブル管理の決済ボタンをStripeに接続
- [ ] Stripe Connectダッシュボード（売上・送金確認）実装

---

## 申請に詰まったら

Stripe サポート（日本語対応）：
- チャット：Stripeダッシュボード右下「？」から
- メール：support@stripe.com
- ドキュメント：https://stripe.com/docs/connect

---

*作成：GOAT Agent / 2026-04-20*
