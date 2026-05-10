-- Supabase SQL Editor에서 실행할 SQL
-- https://supabase.com/dashboard/project/rxmqhkiepfqiaatopunb/editor/sql

-- Users 테이블
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos 테이블 (YouTube/Instagram 분석용)
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL, -- 'youtube', 'instagram', 'tiktok'
  video_id TEXT UNIQUE NOT NULL,
  channel_name TEXT,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  duration INTEGER, -- 초 단위
  published_at TIMESTAMPTZ,
  avg_views INTEGER, -- 채널 평균 조회수
  vs_avg DECIMAL, -- 평균 대비 배율 (outlier 지표)
  tier TEXT, -- 'S', 'A', 'B', 'C'
  score INTEGER, -- 0-100
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 채널 정보 테이블
CREATE TABLE IF NOT EXISTS channels (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL,
  subscriber_count INTEGER,
  total_videos INTEGER,
  avg_views INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_videos_platform ON videos(platform);
CREATE INDEX IF NOT EXISTS idx_videos_vs_avg ON videos(vs_avg DESC);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_scraped_at ON videos(scraped_at DESC);

-- 샘플 데이터 삽입 (테스트용)
INSERT INTO videos (
  platform, video_id, channel_name, title, views, likes, comments, 
  duration, published_at, avg_views, vs_avg, tier, score
) VALUES 
  ('youtube', 'sample001', 'Travel Tube', '경제 뉴스 분석', 150000, 5000, 300, 600, NOW() - INTERVAL '2 days', 50000, 3.0, 'S', 95),
  ('youtube', 'sample002', 'Travel Tube', '부동산 시장 전망', 120000, 4000, 250, 480, NOW() - INTERVAL '3 days', 50000, 2.4, 'A', 88),
  ('youtube', 'sample003', 'Travel Tube', '주식 투자 가이드', 80000, 2500, 180, 420, NOW() - INTERVAL '5 days', 50000, 1.6, 'B', 72),
  ('instagram', 'ig001', 'Content Creator', '릴스 샘플', 50000, 2000, 100, 30, NOW() - INTERVAL '1 day', 20000, 2.5, 'A', 85)
ON CONFLICT (video_id) DO NOTHING;

-- 완료 메시지
SELECT 'Tables created successfully!' AS status;
