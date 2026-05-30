-- 콘텐츠 가이드 생성 히스토리 (원본 + 내 콘텐츠화)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS content_generation_history (
  id                TEXT PRIMARY KEY,
  publish_topic     TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'writing',
  reference_count   INTEGER NOT NULL DEFAULT 0,
  reference_titles  JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft             JSONB NOT NULL,
  polished          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_generation_history_updated
  ON content_generation_history (updated_at DESC);

NOTIFY pgrst, 'reload schema';
