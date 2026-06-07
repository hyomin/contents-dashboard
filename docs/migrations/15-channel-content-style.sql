-- ================================================================
-- 15-channel-content-style.sql
-- 채널의 주력 콘텐츠 스타일(롱폼/숏폼/글) 컬럼 추가
-- 채널·콘텐츠 등록 화면에서 «플랫폼별/스타일별» 그룹핑 토글에 사용
-- 실행: Supabase SQL Editor
-- idempotent — 반복 실행 가능
-- ================================================================

ALTER TABLE channels ADD COLUMN IF NOT EXISTS content_style TEXT;

CREATE INDEX IF NOT EXISTS idx_channels_content_style ON channels(content_style);

COMMENT ON COLUMN channels.content_style IS 'longform | shortform | text | mixed | null(미지정)';

-- 기존 행: 플랫폼 기준으로 합리적인 기본값 채우기 (블로그류=글, TikTok/Instagram=숏폼)
-- YouTube는 롱폼·숏폼이 섞일 수 있어 미지정(null)으로 남겨두고 등록·수정 화면에서 직접 선택
UPDATE channels
SET content_style = CASE
  WHEN platform IN ('naver-blog', 'tistory') THEN 'text'
  WHEN platform IN ('tiktok', 'instagram') THEN 'shortform'
  ELSE content_style
END
WHERE content_style IS NULL;

NOTIFY pgrst, 'reload schema';
