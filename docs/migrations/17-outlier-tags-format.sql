-- outlier_tags.format 컬럼 추가
-- Supabase SQL Editor에 붙여넣고 실행 (idempotent)

ALTER TABLE outlier_tags ADD COLUMN IF NOT EXISTS format TEXT;

COMMENT ON COLUMN outlier_tags.format IS 'short | long | unknown | null(미분류)';

-- 완료 확인
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'outlier_tags' AND column_name = 'format';

NOTIFY pgrst, 'reload schema';
