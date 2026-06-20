-- ================================================================
-- apply-pending-20260617.sql
-- Supabase SQL Editor에 그대로 붙여넣고 실행
-- 모두 idempotent — 이미 적용된 항목은 무시됨
-- ================================================================


-- ─── [1] migration 14 bugfix: update_longform_vs_avg ────────────
-- videos 테이블에 updated_at 컬럼이 없어 함수 호출 시 실패하던 문제 수정

CREATE OR REPLACE FUNCTION update_longform_vs_avg()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
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


-- ─── [2] migration 15: channels.content_style ───────────────────

ALTER TABLE channels ADD COLUMN IF NOT EXISTS content_style TEXT;

CREATE INDEX IF NOT EXISTS idx_channels_content_style ON channels(content_style);

COMMENT ON COLUMN channels.content_style IS 'longform | shortform | text | mixed | null(미지정)';

UPDATE channels
SET content_style = CASE
  WHEN platform IN ('naver-blog', 'tistory') THEN 'text'
  WHEN platform IN ('tiktok', 'instagram')   THEN 'shortform'
  ELSE content_style
END
WHERE content_style IS NULL;


-- ─── 완료 확인 ──────────────────────────────────────────────────
SELECT 'update_longform_vs_avg()' AS item, COUNT(*) AS result FROM pg_proc WHERE proname = 'update_longform_vs_avg'
UNION ALL
SELECT 'channels.content_style', COUNT(*) FROM information_schema.columns
  WHERE table_name = 'channels' AND column_name = 'content_style';

NOTIFY pgrst, 'reload schema';
