-- ================================================================
-- 14-longform-carousel-metrics.sql
-- 롱폼·캐러셀 파이프라인 확장 마이그레이션
-- 실행: Supabase SQL Editor
-- idempotent — 반복 실행 가능
-- ================================================================

-- ─── 1. videos 테이블 — 롱폼·캐러셀 전용 지표 컬럼 ────────────────────
-- 롱폼: 채널 내 롱폼(duration > 180초)만 별도 vs_avg 계산
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vs_avg_longform   DECIMAL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS avg_views_longform INTEGER DEFAULT 0;

-- 캐러셀(Instagram): 저장수·도달수·슬라이드 수
ALTER TABLE videos ADD COLUMN IF NOT EXISTS saved_count  INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS reach        INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS slide_count  INTEGER DEFAULT 0;

-- ─── 2. content_generation_history — 포맷·챕터 마커 컬럼 ────────────────
-- target_format: 'shortform' | 'longform' | 'carousel' | 'blog' | 'sns-caption'
ALTER TABLE content_generation_history
  ADD COLUMN IF NOT EXISTS target_format TEXT DEFAULT 'shortform';

-- chapter_markers: [{"timestamp":"00:00","title":"챕터명","durationSec":90}]
-- 롱폼 생성 결과의 YouTube 설명란 타임스탬프 보존용
ALTER TABLE content_generation_history
  ADD COLUMN IF NOT EXISTS chapter_markers JSONB;

-- ─── 3. 인덱스 ──────────────────────────────────────────────────────────
-- 포맷+플랫폼 조합 조회 (롱폼/숏폼 아웃라이어 분리 분석용)
CREATE INDEX IF NOT EXISTS idx_videos_format_platform_vsavg
  ON videos(format, platform, vs_avg DESC)
  WHERE is_archived = false;

-- 생성 히스토리 포맷별 조회
CREATE INDEX IF NOT EXISTS idx_content_history_target_format
  ON content_generation_history(target_format, updated_at DESC);

-- ─── 4. 롱폼 vs_avg 업데이트 함수 ──────────────────────────────────────
-- n8n 아웃라이어 태깅 워크플로에서 호출:
--   SELECT * FROM update_longform_vs_avg();
CREATE OR REPLACE FUNCTION update_longform_vs_avg()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- 채널별 롱폼(duration > 180초) 평균 조회수 계산 후 vs_avg_longform 업데이트
  WITH longform_channel_avg AS (
    SELECT
      channel_id,
      AVG(views)::INTEGER AS avg_lf
    FROM videos
    WHERE
      duration > 180
      AND is_archived = false
      AND channel_id IS NOT NULL
      AND views > 0
    GROUP BY channel_id
  )
  UPDATE videos v
  SET
    avg_views_longform = lca.avg_lf,
    vs_avg_longform    = CASE
      WHEN lca.avg_lf > 0 THEN ROUND((v.views::DECIMAL / lca.avg_lf), 2)
      ELSE 0
    END
  FROM longform_channel_avg lca
  WHERE
    v.channel_id = lca.channel_id
    AND v.duration > 180
    AND v.is_archived = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_longform_vs_avg() TO service_role;

-- ─── 5. 캐러셀 vs_avg(저장수 기준) 업데이트 함수 ──────────────────────
CREATE OR REPLACE FUNCTION update_carousel_vs_avg()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  WITH carousel_channel_avg AS (
    SELECT
      channel_id,
      AVG(saved_count)::DECIMAL AS avg_saved
    FROM videos
    WHERE
      format = 'carousel'
      AND is_archived = false
      AND channel_id IS NOT NULL
      AND saved_count > 0
    GROUP BY channel_id
  )
  UPDATE videos v
  SET
    vs_avg     = CASE
      WHEN cca.avg_saved > 0 THEN ROUND((v.saved_count::DECIMAL / cca.avg_saved), 2)
      ELSE 0
    END,
    updated_at = NOW()
  FROM carousel_channel_avg cca
  WHERE
    v.channel_id = cca.channel_id
    AND v.format = 'carousel'
    AND v.is_archived = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_carousel_vs_avg() TO service_role;

NOTIFY pgrst, 'reload schema';
