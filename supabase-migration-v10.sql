-- ============================================
-- v10: スタッフ売上ダッシュボード基盤
--   背景: 現場の毎日の売上報告（昼/夜判定 + スタッフ飯）を
--         手計算からダッシュボード自動化へ移行する。
--   追加:
--     1. tenants に昼/夜目標比率カラム
--     2. staff_meals テーブル新設（スタッフ飯の入力・集計）
-- ============================================

-- ① tenants に昼/夜の目標配分を持たせる
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS lunch_target_ratio numeric NOT NULL DEFAULT 0.6;

-- ② staff_meals: スタッフ食事代の入力 / 月集計
CREATE TABLE IF NOT EXISTS staff_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  date date NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_meals_tenant_date
  ON staff_meals (tenant_id, date DESC);

ALTER TABLE staff_meals DISABLE ROW LEVEL SECURITY;
