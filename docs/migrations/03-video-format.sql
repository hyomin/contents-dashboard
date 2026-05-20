-- 영상 포맷(Shorts/롱폼) + 저장한 쇼츠
-- Supabase SQL Editor에서 실행 (반복 실행 가능)

ALTER TABLE videos ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_videos_format ON videos(format);
CREATE INDEX IF NOT EXISTS idx_videos_platform_format ON videos(platform, format);

-- 기존 행: duration 기준으로 format 채우기
UPDATE videos
SET format = CASE
  WHEN duration IS NOT NULL AND duration > 0 AND duration <= 180 THEN 'short'
  WHEN duration IS NOT NULL AND duration > 180 THEN 'long'
  WHEN title ~* '#shorts' THEN 'short'
  ELSE 'unknown'
END
WHERE format IS NULL OR format = 'unknown';

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
CREATE INDEX IF NOT EXISTS idx_saved_shorts_saved_at ON saved_shorts(saved_at DESC);

NOTIFY pgrst, 'reload schema';
