-- ============================================
-- v15: 店頭昼の自動スナップショット（昼確定の時刻依存バグを解消）
--   背景: 昼確定が「その時点の store_sales」を昼店頭に使うため、
--         21時のAnyDeli同期後（store_sales=全日）に昼確定すると
--         店頭が過大計上される時刻依存バグがあった。
--   対応: AnyDeli同期が 15:00〜20:59 JST の窓で走った時に、その時点の
--         店頭合計を store_lunch_sales に固定スナップショット。
--         昼確定は store_lunch_sales を優先使用し、時刻に依存しなくなる。
-- ============================================

ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS store_lunch_sales integer;

COMMENT ON COLUMN daily_sales.store_lunch_sales IS '15時台のAnyDeli同期で固定した店頭昼の合計（円）。NULLなら未取得→昼確定はstore_salesにフォールバック';
