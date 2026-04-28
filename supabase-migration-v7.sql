-- ================================
-- Migration v7
-- 1. attendance に代打フラグ追加
-- 2. store_improvements テーブル新規作成
-- ================================

-- 1. 代打フラグ
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. 店舗改善申告テーブル
CREATE TABLE IF NOT EXISTS store_improvements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id      UUID REFERENCES staff(id) ON DELETE SET NULL,   -- NULL = 匿名
  staff_name    TEXT,                                            -- 匿名時の入力名
  category      TEXT NOT NULL DEFAULT 'other'
                CHECK (category IN ('service','operation','cleanliness','menu','other')),
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  exp_reward    INTEGER NOT NULL DEFAULT 0,
  reviewer_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_store_improvements_tenant_status
  ON store_improvements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_store_improvements_staff
  ON store_improvements(staff_id);

ALTER TABLE store_improvements ENABLE ROW LEVEL SECURITY;

-- サービスロール: 全操作
CREATE POLICY "service_all" ON store_improvements
  FOR ALL TO service_role USING (true);

-- 匿名ユーザー: INSERT のみ
CREATE POLICY "anon_insert" ON store_improvements
  FOR INSERT TO anon WITH CHECK (true);
