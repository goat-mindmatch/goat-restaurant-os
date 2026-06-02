-- ============================================
-- v14: 昼/夜売上の精度向上（デリバリーの昼分を保持）
--   背景: 「昼を確定」スナップショットが店頭(AnyDeli)のみを昼に計上し、
--         Uber/RocketNowの昼注文が丸ごと夜に誤計上されていた（達成40%）。
--   対応: デリバリーの昼分を別カラムで保持し、
--         lunch_sales = 店頭昼 + Uber昼 + RocketNow昼 で確定する。
--         夜 = total - lunch（ダッシュボード算出）で正確になる。
-- ============================================

ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS uber_lunch_sales      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rocketnow_lunch_sales integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN daily_sales.uber_lunch_sales      IS '昼締め時に入力したUberの昼分売上（円）。lunch_sales確定に使用';
COMMENT ON COLUMN daily_sales.rocketnow_lunch_sales IS '昼締め時に入力したRocketNowの昼分売上（円）。lunch_sales確定に使用';
