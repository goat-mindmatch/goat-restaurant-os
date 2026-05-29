-- ============================================
-- v11: Google口コミ自動連携への移行
--   背景: スクショ取得・検証コード入力の運用が現場負担になっており、
--         離脱と工数増の懸念があるため Places API の件数取得結果を
--         自動でスタッフへ配分する方式に切り替える。
--   追加:
--     1. reviews.auto_attributed boolean
--        - Places API クローン由来かどうかの識別子
--        - 既存の検証フローの行と区別する
-- ============================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS auto_attributed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reviews_auto_attributed_date
  ON reviews (tenant_id, auto_attributed, verified_at);
