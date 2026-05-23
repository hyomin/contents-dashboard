-- Migration 09: rss_topic_candidates 에 sources 배열 컬럼 추가
-- 같은 주제를 다룬 피드 이름 목록을 저장 (급상승 감지용)
ALTER TABLE rss_topic_candidates
  ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}';

-- 기존 rows: source_feed 값을 sources 배열로 초기화
UPDATE rss_topic_candidates
  SET sources = ARRAY[source_feed]
  WHERE sources = '{}' OR sources IS NULL;
