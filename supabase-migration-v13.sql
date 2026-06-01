-- ============================================
-- v13: 昼/夜売上の確定スナップショット
--   背景: daily_sales には日次合計しか入らず（AnyDeli/Uber/RocketNowとも
--         時刻分割なし）、lunch_sales/dinner_sales は常に0だった。
--         そのためスタッフダッシュボードの昼/夜判定(×/◯/◎)が
--         「常に×」になる重大バグがあった。
--   仕様: 「昼を確定」操作で その時点の total_sales を lunch_sales に
--         スナップショット。dinner は total - lunch で算出（保存しない）。
--         lunch_confirmed_at で「未確定」と「確定して0」を区別する。
-- ============================================

ALTER TABLE daily_sales
  ADD COLUMN IF NOT EXISTS lunch_confirmed_at timestamptz;

COMMENT ON COLUMN daily_sales.lunch_confirmed_at IS '昼営業終了時に総売上を昼として確定した時刻。NULLなら昼未確定（判定は—表示）';
