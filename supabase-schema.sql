-- ================================================
-- GOAT Restaurant OS - Supabase スキーマ
-- ================================================
-- Supabaseの SQL Editor でこのファイルを実行してください
-- ================================================

-- UUID拡張（Supabaseはデフォルトで有効）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- テナント（飲食店）
-- ================================
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ: 人類みなまぜそば
INSERT INTO tenants (name, slug, plan) VALUES
  ('人類みなまぜそば', 'mazesoba-jinrui', 'starter')
ON CONFLICT (slug) DO NOTHING;

-- ================================
-- スタッフ
-- ================================
CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  line_user_id    TEXT UNIQUE,
  role            TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
  -- スキルマトリクス
  skill_hall      BOOLEAN DEFAULT true,
  skill_cashier   BOOLEAN DEFAULT false,
  skill_kitchen   BOOLEAN DEFAULT false,
  skill_one_op    BOOLEAN DEFAULT false,
  skill_open      BOOLEAN DEFAULT false,
  skill_close     BOOLEAN DEFAULT false,
  -- 給与
  hourly_wage     INTEGER NOT NULL DEFAULT 1100,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 初期データ: スタッフ（人類みなまぜそばのスタッフ習熟度より）
WITH t AS (SELECT id FROM tenants WHERE slug = 'mazesoba-jinrui')
INSERT INTO staff (tenant_id, name, role, skill_hall, skill_cashier, skill_kitchen, skill_one_op, skill_open, skill_close, hourly_wage) VALUES
  ((SELECT id FROM t), '中地',   'manager', true,  true,  true,  true,  true,  true,  1200),
  ((SELECT id FROM t), '河野',   'staff',   true,  true,  true,  true,  false, true,  1100),
  ((SELECT id FROM t), '西岡',   'staff',   true,  true,  false, false, false, false, 1100),
  ((SELECT id FROM t), '畑中',   'staff',   true,  true,  false, false, false, false, 1100),
  ((SELECT id FROM t), '重松',   'staff',   true,  true,  false, false, false, false, 1100),
  ((SELECT id FROM t), '丹後',   'staff',   true,  false, false, false, false, false, 1100),
  ((SELECT id FROM t), '小西',   'staff',   true,  false, false, false, false, false, 1100),
  ((SELECT id FROM t), '小村',   'staff',   true,  false, false, false, false, false, 1100),
  ((SELECT id FROM t), '千葉',   'staff',   true,  false, false, false, false, false, 1100)
ON CONFLICT DO NOTHING;

-- ================================
-- 打刻（出退勤）
-- ================================
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  clock_in      TIME,
  clock_out     TIME,
  break_minutes INTEGER DEFAULT 0,
  work_minutes  INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
      THEN EXTRACT(EPOCH FROM (clock_out - clock_in))::INTEGER / 60 - break_minutes
      ELSE NULL
    END
  ) STORED,
  note          TEXT,
  recorded_via  TEXT DEFAULT 'line' CHECK (recorded_via IN ('line', 'manual')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- ================================
-- シフト希望
-- ================================
CREATE TABLE IF NOT EXISTS shift_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  target_year     INTEGER NOT NULL,
  target_month    INTEGER NOT NULL CHECK (target_month BETWEEN 1 AND 12),
  available_dates DATE[] DEFAULT '{}',
  preferred_dates DATE[] DEFAULT '{}',
  note            TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, target_year, target_month)
);

-- ================================
-- 確定シフト
-- ================================
CREATE TABLE IF NOT EXISTS shifts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  role_on_day TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- 日次売上サマリ
-- ================================
CREATE TABLE IF NOT EXISTS daily_sales (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  store_sales      INTEGER NOT NULL DEFAULT 0,
  delivery_sales   INTEGER NOT NULL DEFAULT 0,
  total_sales      INTEGER GENERATED ALWAYS AS (store_sales + delivery_sales) STORED,
  store_orders     INTEGER DEFAULT 0,
  delivery_orders  INTEGER DEFAULT 0,
  food_cost        INTEGER,
  labor_cost       INTEGER,
  ai_comment       TEXT,
  data_source      TEXT DEFAULT 'manual' CHECK (data_source IN ('anydeli_excel', 'manual', 'api')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- ================================
-- 発注管理
-- ================================
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_name    TEXT NOT NULL,
  supplier_contact TEXT,
  order_date       DATE NOT NULL,
  delivery_date    DATE,
  items            JSONB DEFAULT '[]',
  total_amount     INTEGER,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered', 'cancelled')),
  sent_via         TEXT CHECK (sent_via IN ('line', 'email', 'phone')),
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- インデックス（検索高速化）
-- ================================
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_date ON shifts(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_tenant_date ON daily_sales(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON orders(tenant_id, order_date);

-- ================================
-- updated_at 自動更新トリガー
-- ================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_daily_sales_updated BEFORE UPDATE ON daily_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================
-- Row Level Security（RLS）
-- ================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- サービスロールキーは全アクセス可（API Route専用）
-- anon キーはリードのみ（将来認証追加時に絞る）
CREATE POLICY "service_all" ON tenants FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON staff FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON attendance FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON shift_requests FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON shifts FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON daily_sales FOR ALL TO service_role USING (true);
CREATE POLICY "service_all" ON orders FOR ALL TO service_role USING (true);
