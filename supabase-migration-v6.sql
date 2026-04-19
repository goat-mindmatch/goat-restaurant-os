-- ============================================================
-- Migration v6: 昼夜別売上 + 月次目標 + 業者メール
-- ============================================================

-- daily_sales に昼夜別カラム追加
ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS lunch_sales   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_sales  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_orders  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_orders INTEGER NOT NULL DEFAULT 0;

-- tenants に月次売上目標を追加
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS monthly_target INTEGER NOT NULL DEFAULT 0;

-- 人類みなまぜそばの目標値を設定（月売上目標300万円）
UPDATE tenants SET monthly_target = 3000000 WHERE id::text LIKE '%mazesoba%' OR id::text LIKE '%jinrui%';

-- suppliers に email カラム追加（発注メール送信用）
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS contact_method TEXT NOT NULL DEFAULT 'line'
    CHECK (contact_method IN ('line','email','both'));
