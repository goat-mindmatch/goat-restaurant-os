-- ============================================================
-- GOAT Restaurant OS — 新機能 DBスキーマ
-- 2026-04-20
-- ============================================================

-- ① スタッフRPGシステム
CREATE TABLE IF NOT EXISTS staff_rpg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 1,
  exp int NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '駆け出しスタッフ',
  badges jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, staff_id)
);

-- ② 日次ミッション（店舗全体の目標）
CREATE TABLE IF NOT EXISTS daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  target_revenue int NOT NULL DEFAULT 0,
  bonus_description text DEFAULT '目標達成ボーナス ¥500/人',
  dispatched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, date)
);

-- ③ 仕込みタスクテンプレート
CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  title text NOT NULL,
  description text,
  timing text NOT NULL DEFAULT 'open',  -- open / during / close
  order_index int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ④ 仕込みタスク日別ログ
CREATE TABLE IF NOT EXISTS task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  template_id uuid REFERENCES task_templates(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  timing text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  completed_by uuid REFERENCES staff(id),
  note text,
  created_at timestamptz DEFAULT now()
);

-- ⑤ テーブル呼び出しログ
CREATE TABLE IF NOT EXISTS table_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  table_number int NOT NULL,
  table_name text,
  call_type text NOT NULL DEFAULT 'staff',  -- staff / water / bill
  status text NOT NULL DEFAULT 'pending',   -- pending / responded
  responded_at timestamptz,
  responded_by uuid REFERENCES staff(id),
  created_at timestamptz DEFAULT now()
);

-- ⑥ お客様ロイヤルティ
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  line_user_id text,
  display_name text,
  points int NOT NULL DEFAULT 0,
  visit_count int NOT NULL DEFAULT 0,
  total_spent int NOT NULL DEFAULT 0,
  birthday date,
  last_visit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, line_user_id)
);

-- ⑦ ポイント取引履歴
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id uuid REFERENCES customer_loyalty(id) ON DELETE CASCADE,
  points int NOT NULL,
  type text NOT NULL DEFAULT 'earn',  -- earn / redeem / bonus / birthday
  description text,
  created_at timestamptz DEFAULT now()
);

-- ⑧ SNS投稿スケジュール
CREATE TABLE IF NOT EXISTS sns_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  title text NOT NULL,
  caption text NOT NULL,
  hashtags text,
  image_url text,
  platforms jsonb NOT NULL DEFAULT '["instagram"]',
  scheduled_at timestamptz,
  posted_at timestamptz,
  status text NOT NULL DEFAULT 'draft',  -- draft / scheduled / posted / failed
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- ⑨ AI店長アラートログ
CREATE TABLE IF NOT EXISTS ai_manager_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  alert_type text NOT NULL,  -- low_sales / high_labor / low_stock / etc
  message text NOT NULL,
  action_taken text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ⑩ 週次AIレポートキャッシュ
CREATE TABLE IF NOT EXISTS weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  report_json jsonb NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, week_start)
);

-- サンプルタスクテンプレート（実行時にTENANT_IDに置き換え）
-- INSERT INTO task_templates (tenant_id, title, timing, order_index) VALUES
-- ('YOUR_TENANT_ID', 'キャベツの千切り（5kg）', 'open', 1),
-- ('YOUR_TENANT_ID', 'スープの仕込み確認', 'open', 2),
-- ('YOUR_TENANT_ID', '麺の在庫確認', 'open', 3),
-- ('YOUR_TENANT_ID', '床清掃・テーブル消毒', 'open', 4),
-- ('YOUR_TENANT_ID', 'レジ釣り銭確認', 'open', 5),
-- ('YOUR_TENANT_ID', '食器類の補充', 'during', 1),
-- ('YOUR_TENANT_ID', 'トイレ清掃', 'during', 2),
-- ('YOUR_TENANT_ID', 'レジ締め', 'close', 1),
-- ('YOUR_TENANT_ID', '食材の保存・ラップ', 'close', 2),
-- ('YOUR_TENANT_ID', '床清掃（閉店後）', 'close', 3),
-- ('YOUR_TENANT_ID', 'ゴミ出し', 'close', 4);
