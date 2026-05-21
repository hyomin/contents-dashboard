-- RSS 주제 후보 (n8n · /api/dashboard/rss-topics)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS rss_topic_candidates (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  link                TEXT,
  source_feed         TEXT NOT NULL,
  summary             TEXT,
  published_at        TIMESTAMPTZ,
  relevance_score     DECIMAL NOT NULL DEFAULT 0,
  target_audience     TEXT NOT NULL DEFAULT '시니어',
  collected_at        TIMESTAMPTZ DEFAULT NOW(),
  source              TEXT NOT NULL DEFAULT 'dashboard',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rss_topic_candidates_score ON rss_topic_candidates(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_rss_topic_candidates_collected ON rss_topic_candidates(collected_at DESC);

NOTIFY pgrst, 'reload schema';
