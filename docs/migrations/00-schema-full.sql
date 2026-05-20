-- ================================================================
-- Contents Dashboard - Supabase 전체 스키마
-- 경로: docs/migrations/00-schema-full.sql
-- 실행: Supabase SQL Editor
-- idempotent (IF NOT EXISTS) — 반복 실행 가능
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
  format        TEXT DEFAULT 'unknown',  -- 'short' | 'long' | 'unknown' (Shorts: duration ≤ 180초)
  published_at  TIMESTAMPTZ,
  avg_views     INTEGER DEFAULT 0,       -- 채널 평균 조회수
  vs_avg        DECIMAL DEFAULT 0,       -- 평균 대비 배율 (outlier 지표)
  tier          TEXT DEFAULT 'C',        -- 'S', 'A', 'B', 'C'
  score         INTEGER DEFAULT 0,       -- 0-100
  scraped_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3-a. benchmark_categories 테이블 ────────────────────────
CREATE TABLE IF NOT EXISTS benchmark_categories (
  id         TEXT PRIMARY KEY,          -- 'cat-xxxx'
  name       TEXT NOT NULL,
  bg_color   TEXT NOT NULL DEFAULT '#3B82F6',
  text_color TEXT NOT NULL DEFAULT 'auto',  -- 'auto' | 'white' | 'dark'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3-b. benchmarks 테이블 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS benchmarks (
  id          TEXT PRIMARY KEY,          -- 'bm-xxxx'
  url         TEXT NOT NULL,
  title       TEXT NOT NULL,
  memo        TEXT DEFAULT '',
  category_id TEXT REFERENCES benchmark_categories(id) ON DELETE SET NULL,
  platform    TEXT NOT NULL DEFAULT 'other',
  views       INTEGER,
  vs_avg      DECIMAL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_category ON benchmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_platform  ON benchmarks(platform);

-- ─── 3-1. videos 테이블 누락 컬럼 보완 (기존 테이블에 추가 실행) ──
ALTER TABLE videos ADD COLUMN IF NOT EXISTS channel_id    TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes         INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS comments      INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration      INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS format        TEXT DEFAULT 'unknown';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS published_at  TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS avg_views     INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vs_avg        DECIMAL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tier          TEXT DEFAULT 'C';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS score         INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS scraped_at    TIMESTAMPTZ DEFAULT NOW();

-- 스키마 캐시 강제 갱신
NOTIFY pgrst, 'reload schema';

-- ─── 4. 대시보드 워크스페이스 (Prisma/localStorage 대체 · 단일 Supabase) ──
CREATE TABLE IF NOT EXISTS channel_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '📁',
  bg_color   TEXT NOT NULL DEFAULT '#6B7280',
  text_color TEXT NOT NULL DEFAULT 'auto',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES channel_categories(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS channel_flags (
  channel_id   TEXT PRIMARY KEY REFERENCES channels(channel_id) ON DELETE CASCADE,
  is_tracked   BOOLEAN NOT NULL DEFAULT true,
  is_mine      BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_items (
  id           TEXT PRIMARY KEY,
  day          TEXT NOT NULL,
  title        TEXT NOT NULL,
  platform     TEXT NOT NULL DEFAULT 'youtube',
  status       TEXT NOT NULL DEFAULT 'idea',
  time_label   TEXT NOT NULL DEFAULT '미정',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repurpose_items (
  id               TEXT PRIMARY KEY,
  source_title     TEXT NOT NULL,
  source_platform  TEXT NOT NULL DEFAULT 'youtube',
  source_vs_avg    DECIMAL DEFAULT 0,
  video_id         TEXT,
  tasks            JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deploy_tasks (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  platform       TEXT NOT NULL DEFAULT 'youtube',
  icon           TEXT NOT NULL DEFAULT '🔗',
  scheduled_at   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',
  channel        TEXT DEFAULT '',
  auto           BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_items_status ON calendar_items(status);
CREATE INDEX IF NOT EXISTS idx_repurpose_items_vs_avg ON repurpose_items(source_vs_avg DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_tasks_status ON deploy_tasks(status);

CREATE TABLE IF NOT EXISTS saved_shorts (
  video_id       TEXT PRIMARY KEY,
  channel_id     TEXT,
  channel_name   TEXT,
  title          TEXT NOT NULL,
  thumbnail_url  TEXT,
  views          INTEGER DEFAULT 0,
  vs_avg         DECIMAL DEFAULT 0,
  duration       INTEGER DEFAULT 0,
  saved_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_shorts_vs_avg ON saved_shorts(vs_avg DESC);

-- ─── 4-b. outlier_tags (n8n 아웃라이어 자동 태깅) ─────────────────
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

-- ─── 5. 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_channels_platform   ON channels(platform);

CREATE INDEX IF NOT EXISTS idx_videos_channel_id   ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_platform     ON videos(platform);
CREATE INDEX IF NOT EXISTS idx_videos_vs_avg       ON videos(vs_avg DESC);
CREATE INDEX IF NOT EXISTS idx_videos_tier         ON videos(tier);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_scraped_at   ON videos(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_format       ON videos(format);
CREATE INDEX IF NOT EXISTS idx_videos_platform_format ON videos(platform, format);

-- ─── 6. 결과 확인 ────────────────────────────────────────────────
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
