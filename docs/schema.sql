-- ================================================================
-- Contents Dashboard - Supabase 전체 스키마
-- 실행 위치: https://supabase.com/dashboard/project/rxmqhkiepfqiaatopunb/editor/sql
-- 모든 구문이 idempotent (IF NOT EXISTS) 처리되어 있으므로 반복 실행 가능
-- ================================================================

-- ─── 1. users 테이블 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. channels 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id           SERIAL PRIMARY KEY,
  channel_id   TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL,
  platform     TEXT NOT NULL DEFAULT 'youtube',
  subscribers  BIGINT DEFAULT 0,
  total_views  BIGINT DEFAULT 0,
  video_count  INTEGER DEFAULT 0,
  avg_views    INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. videos 테이블 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id            SERIAL PRIMARY KEY,
  platform      TEXT NOT NULL,           -- 'youtube', 'instagram', 'tiktok'
  video_id      TEXT UNIQUE NOT NULL,
  channel_id    TEXT,
  channel_name  TEXT,
  title         TEXT NOT NULL,
  thumbnail_url TEXT,
  views         INTEGER DEFAULT 0,
  likes         INTEGER DEFAULT 0,
  comments      INTEGER DEFAULT 0,
  duration      INTEGER,                 -- 초 단위
  published_at  TIMESTAMPTZ,
  avg_views     INTEGER DEFAULT 0,       -- 채널 평균 조회수
  vs_avg        DECIMAL DEFAULT 0,       -- 평균 대비 배율 (outlier 지표)
  tier          TEXT DEFAULT 'C',        -- 'S', 'A', 'B', 'C'
  score         INTEGER DEFAULT 0,       -- 0-100
  scraped_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_platform   ON channels(platform);

CREATE INDEX IF NOT EXISTS idx_videos_channel_id   ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_platform     ON videos(platform);
CREATE INDEX IF NOT EXISTS idx_videos_vs_avg       ON videos(vs_avg DESC);
CREATE INDEX IF NOT EXISTS idx_videos_tier         ON videos(tier);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_scraped_at   ON videos(scraped_at DESC);

-- ─── 5. 결과 확인 ────────────────────────────────────────────────
SELECT table_name, COUNT(*) AS rows
FROM (
  SELECT 'users'    AS table_name, id FROM users
  UNION ALL
  SELECT 'channels', id FROM channels
  UNION ALL
  SELECT 'videos',   id FROM videos
) t
GROUP BY table_name
ORDER BY table_name;
