-- ============================================================
-- Migration v5: Google口コミキャッシュ + 在庫管理テーブル追加
-- Supabaseのクエリエディタで実行してください
-- ============================================================

-- ================================
-- Google口コミ件数履歴
-- ================================
CREATE TABLE IF NOT EXISTS google_review_count_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  count       INTEGER NOT NULL DEFAULT 0,
  rating      NUMERIC(3,1),
  checked_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_google_review_history_tenant
  ON google_review_count_history(tenant_id, checked_at DESC);

-- ================================
-- Google口コミキャッシュ（最新5件）
-- ================================
CREATE TABLE IF NOT EXISTS google_reviews_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_id     TEXT NOT NULL,
  reviewer_name TEXT,
  star_rating   TEXT,
  comment       TEXT,
  created_time  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, review_id)
);
CREATE INDEX IF NOT EXISTS idx_google_reviews_cache_tenant
  ON google_reviews_cache(tenant_id, created_time DESC);

-- ================================
-- 在庫管理
-- ================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'food'
                CHECK (category IN ('food','drink','consumable','other')),
  unit          TEXT NOT NULL DEFAULT 'kg',
  current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock     NUMERIC(10,2) NOT NULL DEFAULT 0,  -- アラート閾値
  supplier_id   UUID REFERENCES suppliers(id),
  note          TEXT,
  is_active     BOOLEAN DEFAULT true,
  last_updated  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant
  ON inventory_items(tenant_id, category, is_active);

-- ================================
-- 在庫変動ログ
-- ================================
CREATE TABLE IF NOT EXISTS inventory_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  change_amount NUMERIC(10,2) NOT NULL,  -- 正=入荷, 負=消費
  reason        TEXT,                    -- 'receive','use','adjustment'
  note          TEXT,
  created_by    UUID REFERENCES staff(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS（全テーブルサービスロールから更新可能）
ALTER TABLE google_review_count_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_reviews_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs              ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='google_review_count_history' AND policyname='service_all') THEN
    CREATE POLICY service_all ON google_review_count_history FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='google_reviews_cache' AND policyname='service_all') THEN
    CREATE POLICY service_all ON google_reviews_cache FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_items' AND policyname='service_all') THEN
    CREATE POLICY service_all ON inventory_items FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_logs' AND policyname='service_all') THEN
    CREATE POLICY service_all ON inventory_logs FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- サンプルデータ（まぜそば店の主要食材）
-- ※ tenant_id は実際の値に置き換えてください（下記はmazesoba-jinruiのID）
-- INSERT INTO inventory_items (tenant_id, name, category, unit, current_stock, min_stock)
-- SELECT id, '中華麺', 'food', 'kg', 10, 3 FROM tenants WHERE id::text LIKE '%mazesoba%';
