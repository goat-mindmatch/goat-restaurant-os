-- ============================================
-- v12: 昼/夜の日次売上目標を管理画面から個別設定可能にする
--   背景: スタッフ売上ダッシュボードの×/◯/◎判定は当初
--         月次目標 × 固定比率(0.6) で昼/夜を算出していたが、
--         「管理画面で昼目標・夜目標を別途設定したい」という要望のため
--         明示的な日次目標カラムを追加する。
--   仕様:
--     - lunch_target / dinner_target は「日次」の目標金額（円）
--     - NULL の場合は従来どおり monthly_target × lunch_target_ratio で算出
--       （後方互換）
-- ============================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS lunch_target  integer,
  ADD COLUMN IF NOT EXISTS dinner_target integer;

COMMENT ON COLUMN tenants.lunch_target  IS '昼の日次売上目標（円）。NULLなら monthly_target×lunch_target_ratio で自動算出';
COMMENT ON COLUMN tenants.dinner_target IS '夜の日次売上目標（円）。NULLなら monthly_target×(1-lunch_target_ratio) で自動算出';
