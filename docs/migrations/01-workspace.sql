-- 워크스페이스 테이블 (docs/migrations/00-schema-full.sql 4절과 동일 · 이미 적용했다면 생략)
-- Supabase SQL Editor에서 실행

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

NOTIFY pgrst, 'reload schema';
