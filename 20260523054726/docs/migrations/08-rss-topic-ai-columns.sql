-- rss_topic_candidates: Gemini AI 정제 결과 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE rss_topic_candidates
  ADD COLUMN IF NOT EXISTS ai_title TEXT,
  ADD COLUMN IF NOT EXISTS ai_reason TEXT;

COMMENT ON COLUMN rss_topic_candidates.ai_title  IS 'Gemini가 제안한 유튜브·블로그 제목';
COMMENT ON COLUMN rss_topic_candidates.ai_reason IS 'Gemini 선별 이유 (1줄 요약)';

NOTIFY pgrst, 'reload schema';
