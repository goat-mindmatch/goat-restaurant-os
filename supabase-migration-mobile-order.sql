-- ================================================
-- Migration: モバイルオーダー（M2）
-- menu_items + customer_orders テーブル追加
-- ================================================

-- ================================
-- メニュー商品マスタ
-- ================================
CREATE TABLE IF NOT EXISTS menu_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  price        INTEGER NOT NULL,
  category     TEXT NOT NULL DEFAULT 'main'
               CHECK (category IN ('main','topping','drink','side','other')),
  image_url    TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON menu_items FOR ALL TO service_role USING (true);
-- お客様（anon）はメニューを読み取れる
CREATE POLICY "anon_read" ON menu_items FOR SELECT TO anon USING (is_available = true);
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON menu_items(tenant_id, sort_order);

-- 初期メニューデータ: 人類みなまぜそば
WITH t AS (SELECT id FROM tenants WHERE slug = 'mazesoba-jinrui')
INSERT INTO menu_items (tenant_id, name, description, price, category, sort_order) VALUES
  ((SELECT id FROM t), '人類みな麺',        'こってり醤油ベースの自家製まぜそば。背脂チャッチャ',   980,  'main',    1),
  ((SELECT id FROM t), '何の変哲も麺',      'あっさり塩ベース。素材の旨みを引き出したシンプルな一杯', 950,  'main',    2),
  ((SELECT id FROM t), '追い飯',            'まぜそばのタレと混ぜて食べる〆のご飯',                 100,  'side',    10),
  ((SELECT id FROM t), '煮玉子',            'とろとろ半熟の味付け玉子',                             150,  'topping', 20),
  ((SELECT id FROM t), 'チャーシュー増し',  '自家製チャーシュー2枚追加',                            200,  'topping', 21),
  ((SELECT id FROM t), '瓶ビール',          'サッポロ黒ラベル',                                     600,  'drink',   30),
  ((SELECT id FROM t), 'ソフトドリンク',    'コーラ・オレンジ・ウーロン茶',                         300,  'drink',   31)
ON CONFLICT DO NOTHING;

-- ================================
-- お客様注文
-- ================================
CREATE TABLE IF NOT EXISTS customer_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_number   INTEGER NOT NULL,
  items          JSONB NOT NULL DEFAULT '[]',
  total_amount   INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash'
                 CHECK (payment_method IN ('cash', 'paypay', 'line_pay', 'card')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','confirmed','cooking','ready','served','cancelled')),
  paypay_order_id TEXT,
  note           TEXT,
  notified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON customer_orders FOR ALL TO service_role USING (true);
-- お客様は自分の注文を作成できる（anon insert）
CREATE POLICY "anon_insert" ON customer_orders FOR INSERT TO anon WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_customer_orders_tenant ON customer_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(tenant_id, status);

-- updated_at トリガー
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_menu_items_updated') THEN
    CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_customer_orders_updated') THEN
    CREATE TRIGGER trg_customer_orders_updated BEFORE UPDATE ON customer_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
