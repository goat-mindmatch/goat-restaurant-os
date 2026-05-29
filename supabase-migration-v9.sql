-- ============================================
-- v9: スタッフ登録の信頼性強化
--   背景: 「畑中」が3件重複登録され、webhook の .single() が
--         複数マッチで失敗 → 「スタッフ情報が見つかりませんでした」を返していた。
--   対応:
--     1. staff の (tenant_id, name) を UNIQUE 化（重複削除後に適用）
--     2. staff_registration_attempts テーブルを新設し、
--        LINE登録で見つからなかった試行を蓄積 + 経営者通知できるようにする
--
--   注意: ALTER TABLE staff ... UNIQUE は重複が残っているとエラーになる。
--         先に重複レコード（参照 0 件のもの）を物理削除してから実行すること。
-- ============================================

-- ============================================
-- ① 重複レコード削除（畑中）
--   保持: 52bfbad8-227a-4023-bcb0-303a06f119c5（reviews 1件参照あり）
--   削除: 他2件（全テーブル参照 0 件）
--
--   ※ 本マイグレーション適用前の 2026-05-28 時点で
--     アプリ側から既にDELETE実行済み。再度実行しても
--     対象行が存在しないだけで害はないため残してある。
-- ============================================
DELETE FROM staff WHERE id = 'f4054b6b-ada2-4fce-882c-6d8e0a95c9b4';
DELETE FROM staff WHERE id = '292b5559-5ace-4cbf-af03-bbb5a1c43145';

-- ============================================
-- ② staff の (tenant_id, name) を UNIQUE 化
--   同一テナント内で同姓スタッフを登録したい場合は name に
--   識別子を付ける運用とする（例: 「中地」「中地_旧」が既に存在）
--   ※ 重複が残っているとエラーになる。先に①の DELETE が成功している前提。
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_tenant_name_unique'
  ) THEN
    ALTER TABLE staff
      ADD CONSTRAINT staff_tenant_name_unique UNIQUE (tenant_id, name);
  END IF;
END $$;

-- ============================================
-- ③ staff_registration_attempts: 名前不一致の試行ログ
--   webhook の handleNameInput が未検出時に INSERT する
--   登録が完了したら resolved_at + resolved_staff_id を UPDATE
-- ============================================
CREATE TABLE IF NOT EXISTS staff_registration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  input_name text NOT NULL,
  normalized_name text NOT NULL,
  line_user_id text NOT NULL,
  resolved_at timestamptz,
  resolved_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_tenant_unresolved
  ON staff_registration_attempts (tenant_id, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_line_user
  ON staff_registration_attempts (line_user_id);

-- RLS: service role からの読み書きのみ想定。
-- アプリ側はservice_role_keyで操作するためRLSは無効でOK
ALTER TABLE staff_registration_attempts DISABLE ROW LEVEL SECURITY;
