-- 주제 키워드 가이드 히스토리 (입력 키워드 · AI 제안 목록 · 사용자 선택)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS topic_keyword_guide_history (
  id                      TEXT PRIMARY KEY,
  seed_keyword            TEXT NOT NULL DEFAULT '',
  category                TEXT NOT NULL DEFAULT 'writing',
  suggestions             JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_suggestion     JSONB,
  selected_publish_topic  TEXT,
  guide_generated_at      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_keyword_guide_history_updated
  ON topic_keyword_guide_history (updated_at DESC);

NOTIFY pgrst, 'reload schema';
