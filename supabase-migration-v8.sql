-- ============================================================
-- Migration v8: 口コミ感情分析（sentiment）カラム追加
-- ============================================================
-- reviews テーブルに必要なカラムを追加

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS sentiment    TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS exp_awarded  INTEGER DEFAULT 150;

-- 既存の承認済みレコードは neutral / 150 EXP で初期化
UPDATE reviews
  SET sentiment   = 'neutral',
      exp_awarded = 150
  WHERE verified_at IS NOT NULL
    AND sentiment IS NULL;

COMMENT ON COLUMN reviews.sentiment   IS 'AIによる口コミ感情判定: positive=褒め / neutral=普通 / negative=ネガ';
COMMENT ON COLUMN reviews.exp_awarded IS '実際に付与したEXP（positive=200 / neutral=150 / negative=120）';
