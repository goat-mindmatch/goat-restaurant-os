-- ============================================================
-- Migration v3: 発注アラート改善 + シフト自動収集のための追加
-- Supabaseのクエリエディタで実行してください
-- ============================================================

-- orders テーブルにアラート送信済みフラグを追加
ALTER TABLE orders ADD COLUMN IF NOT EXISTS alert_sent_at TIMESTAMPTZ DEFAULT NULL;

-- status に 'alerted' を追加（元のCHECK制約は変えない、NULLで管理）
-- alert_sent_at IS NULL = まだアラート未送信
-- alert_sent_at IS NOT NULL = アラート送信済み

-- インデックス: 未確認発注の効率的な検索
CREATE INDEX IF NOT EXISTS idx_orders_alert
  ON orders (tenant_id, status, updated_at)
  WHERE status = 'sent' AND alert_sent_at IS NULL;

-- shift_requests テーブルに「収集メッセージ送信日時」を記録（任意）
ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ DEFAULT NULL;

-- 確認用クエリ（実行後に構造確認）
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'orders' ORDER BY ordinal_position;
