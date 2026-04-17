-- ================================================
-- Migration: expenses + fixed_costs テーブル追加
-- 既存のSupabase DBにこのSQLをSQL Editorで実行してください
-- ================================================

-- ================================
-- 経費（レシートOCR→PL反映）
-- ================================
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('food','utility','consumable','equipment','rent','communication','other')),
  vendor          TEXT,
  amount          INTEGER NOT NULL,
  tax_amount      INTEGER DEFAULT 0,
  note            TEXT,
  receipt_url     TEXT,
  ai_extracted    BOOLEAN DEFAULT false,
  recorded_by     UUID REFERENCES staff(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 固定費マスタ（家賃・通信費等）
-- ================================
CREATE TABLE IF NOT EXISTS fixed_costs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other'
              CHECK (category IN ('rent','communication','equipment','other')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ: 人類みなまぜそば 固定費（実際の金額に合わせて変更してください）
WITH t AS (SELECT id FROM tenants WHERE slug = 'mazesoba-jinrui')
INSERT INTO fixed_costs (tenant_id, name, amount, category) VALUES
  ((SELECT id FROM t), '家賃',   280000, 'rent'),
  ((SELECT id FROM t), '通信費',   8000, 'communication')
ON CONFLICT DO NOTHING;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON expenses(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(tenant_id, category);

-- updated_at トリガー
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON expenses FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON fixed_costs FOR ALL TO service_role USING (true);
