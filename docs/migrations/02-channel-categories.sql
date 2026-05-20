-- 채널 주제 카테고리 (육아·경제·게임 등 — 사용자 지정)
-- Supabase SQL Editor에서 실행

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

CREATE INDEX IF NOT EXISTS idx_channels_category_id ON channels(category_id);

-- 기본 카테고리 (없을 때만)
INSERT INTO channel_categories (id, name, icon, bg_color, sort_order)
VALUES
  ('cat-parenting', '육아', '👶', '#F472B6', 10),
  ('cat-economy', '경제', '💰', '#34D399', 20),
  ('cat-game', '게임', '🎮', '#818CF8', 30),
  ('cat-education', '교육', '📚', '#38BDF8', 40),
  ('cat-lifestyle', '라이프', '🏠', '#FBBF24', 50),
  ('cat-tech', 'IT·테크', '💻', '#60A5FA', 60),
  ('cat-entertainment', '엔터', '🎭', '#A78BFA', 70),
  ('cat-news', '뉴스·시사', '📰', '#94A3B8', 80),
  ('cat-other', '기타', '📁', '#9CA3AF', 99)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
