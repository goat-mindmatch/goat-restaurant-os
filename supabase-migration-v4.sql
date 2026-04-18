-- ============================================================
-- Migration v4: デリバリー媒体別売上カラム追加
-- 店内 / Uber Eats / ロケットなう / menu（将来）を個別管理
-- Supabaseのクエリエディタで実行してください
-- ============================================================

-- Uber Eats 売上・件数
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS uber_sales     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS uber_orders    INTEGER          DEFAULT 0;

-- ロケットなう 売上・件数
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS rocketnow_sales  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS rocketnow_orders INTEGER          DEFAULT 0;

-- menu 売上・件数（将来用・今は 0 のまま）
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS menu_sales   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_sales ADD COLUMN IF NOT EXISTS menu_orders  INTEGER          DEFAULT 0;

-- ※ delivery_sales / delivery_orders は後方互換のため残す
--   アプリ側で uber + rocketnow + menu の合計を delivery_sales にセットする
--   total_sales GENERATED は store_sales + delivery_sales のままで OK

-- 確認クエリ（実行後に動作確認）
-- SELECT date, store_sales, uber_sales, rocketnow_sales, menu_sales, delivery_sales, total_sales
-- FROM daily_sales ORDER BY date DESC LIMIT 5;
