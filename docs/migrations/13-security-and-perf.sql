-- ================================================================
-- 13-security-and-perf.sql
-- 보안 강화 + 성능 개선 마이그레이션
-- 실행: Supabase SQL Editor
-- idempotent — 반복 실행 가능
-- ================================================================

-- ─── 1. 로그인 rate limit 테이블 (in-memory Map 대체) ────────────────
-- 서버리스 인스턴스 간 상태 공유를 위해 DB로 이관
CREATE TABLE IF NOT EXISTS login_rate_limits (
  key           TEXT PRIMARY KEY,
  failures      INTEGER NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE login_rate_limits ENABLE ROW LEVEL SECURITY;
-- 정책 없음: service_role만 접근 (RLS가 anon 접근을 차단)

-- ─── 2. videos 소프트 딜리트 컬럼 ───────────────────────────────────
-- lookback 기간 변경 시 기존 데이터 영구 삭제 방지
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- 활성 영상 조회 시 is_archived=false 필터 인덱스
CREATE INDEX IF NOT EXISTS idx_videos_is_archived_false
  ON videos(is_archived) WHERE is_archived = false;

-- ─── 3. 주요 테이블 RLS 활성화 (anon key 직접 접근 차단) ─────────────
-- service_role은 RLS를 우회하므로 서버 사이드 코드는 영향 없음
-- anon key로 Supabase PostgREST에 직접 접근하는 경우만 차단됨

ALTER TABLE videos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE repurpose_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_shorts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlier_tags        ENABLE ROW LEVEL SECURITY;

-- ─── 4. DB 집계 RPC 함수 (메모리 집계 → DB 처리) ─────────────────────

-- 4-a. 영상 통계 요약 (getVideoStats 대체)
CREATE OR REPLACE FUNCTION get_video_stats_summary()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total',    COUNT(*),
    'avgVsAvg', ROUND(AVG(COALESCE(vs_avg, 0))::NUMERIC, 1),
    'byPlatform', COALESCE((
      SELECT jsonb_object_agg(platform, cnt)
      FROM (
        SELECT platform, COUNT(*) AS cnt
        FROM videos
        WHERE is_archived = false
        GROUP BY platform
      ) p
    ), '{}'::jsonb),
    'byTier', COALESCE((
      SELECT jsonb_object_agg(tier, cnt)
      FROM (
        SELECT tier, COUNT(*) AS cnt
        FROM videos
        WHERE tier IS NOT NULL AND is_archived = false
        GROUP BY tier
      ) t
    ), '{}'::jsonb)
  )
  FROM videos
  WHERE is_archived = false
$$;

-- 4-b. 채널별 영상 수 (getVideoCountByChannel 대체)
CREATE OR REPLACE FUNCTION get_video_count_by_channel()
RETURNS TABLE (channel_id TEXT, video_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT channel_id, COUNT(*) AS video_count
  FROM videos
  WHERE channel_id IS NOT NULL AND is_archived = false
  GROUP BY channel_id
$$;

-- 4-c. 채널별 최고 vs_avg (getBestVsAvgByChannel 대체)
CREATE OR REPLACE FUNCTION get_best_vs_avg_by_channel()
RETURNS TABLE (channel_id TEXT, best_vs_avg NUMERIC)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT channel_id, MAX(vs_avg) AS best_vs_avg
  FROM videos
  WHERE channel_id IS NOT NULL AND is_archived = false
  GROUP BY channel_id
$$;

-- service_role에만 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_video_stats_summary()      TO service_role;
GRANT EXECUTE ON FUNCTION get_video_count_by_channel()   TO service_role;
GRANT EXECUTE ON FUNCTION get_best_vs_avg_by_channel()   TO service_role;

-- ─── 5. 오래된 rate limit 레코드 자동 정리 ─────────────────────────
-- 15분 윈도우 만료 + 잠금 해제된 레코드 정리 함수
CREATE OR REPLACE FUNCTION cleanup_login_rate_limits()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM login_rate_limits
    WHERE
      (locked_until IS NULL AND window_start < NOW() - INTERVAL '15 minutes')
      OR (locked_until IS NOT NULL AND locked_until < NOW() - INTERVAL '1 hour')
    RETURNING key
  )
  SELECT COUNT(*)::INTEGER FROM deleted
$$;

GRANT EXECUTE ON FUNCTION cleanup_login_rate_limits() TO service_role;

NOTIFY pgrst, 'reload schema';
