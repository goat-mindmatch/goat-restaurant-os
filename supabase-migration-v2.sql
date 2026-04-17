-- ================================================
-- Migration v2: 不足テーブル・カラム補完
-- エラー率調査で判明した不足分を追加
-- 既存のSupabase DBにこのSQLをSQL Editorで実行してください
-- ================================================

-- ================================
-- staff テーブルに不足カラムを追加
-- ================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS transport_fee INTEGER DEFAULT 0;

-- ================================
-- suppliers（業者マスタ）
-- ================================
CREATE TABLE IF NOT EXISTS suppliers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  contact_type   TEXT CHECK (contact_type IN ('line', 'email', 'phone')),
  contact_value  TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON suppliers FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- ================================
-- line_sessions（LINEセッション管理）
-- ================================
CREATE TABLE IF NOT EXISTS line_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT NOT NULL UNIQUE,
  state        TEXT,
  meta         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE line_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON line_sessions FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_line_sessions_user ON line_sessions(line_user_id);

-- ================================
-- reviews（口コミ管理）
-- ================================
CREATE TABLE IF NOT EXISTS reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id              UUID REFERENCES staff(id),
  customer_line_user_id TEXT,
  clicked_at            TIMESTAMPTZ DEFAULT NOW(),
  completed             BOOLEAN DEFAULT false,
  completed_at          TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES staff(id),
  coupon_code           TEXT,
  coupon_used           BOOLEAN DEFAULT false,
  screenshot_url        TEXT,
  screenshot_verdict    TEXT,
  note                  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON reviews FOR ALL TO service_role USING (true);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant ON reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_staff ON reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_reviews_clicked_at ON reviews(tenant_id, clicked_at);

-- ================================
-- pending_registrations（LINE登録待ち）
-- ================================
CREATE TABLE IF NOT EXISTS pending_registrations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON pending_registrations FOR ALL TO service_role USING (true);

-- ================================
-- updated_at トリガー（新テーブル分）
-- ================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_suppliers_updated') THEN
    CREATE TRIGGER trg_suppliers_updated
      BEFORE UPDATE ON suppliers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_line_sessions_updated') THEN
    CREATE TRIGGER trg_line_sessions_updated
      BEFORE UPDATE ON line_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reviews_updated') THEN
    CREATE TRIGGER trg_reviews_updated
      BEFORE UPDATE ON reviews
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
