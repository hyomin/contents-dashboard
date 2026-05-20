-- 아웃라이어 자동 태깅 (n8n · /api/dashboard/outlier-tag)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS outlier_tags (
  video_id              TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  channel_id            TEXT,
  channel_name          TEXT,
  platform              TEXT NOT NULL DEFAULT 'youtube',
  vs_avg                DECIMAL NOT NULL DEFAULT 0,
  min_vs_avg_threshold  DECIMAL NOT NULL DEFAULT 3,
  tagged_at             TIMESTAMPTZ DEFAULT NOW(),
  source                TEXT NOT NULL DEFAULT 'n8n',
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlier_tags_vs_avg ON outlier_tags(vs_avg DESC);
CREATE INDEX IF NOT EXISTS idx_outlier_tags_tagged_at ON outlier_tags(tagged_at DESC);

NOTIFY pgrst, 'reload schema';
