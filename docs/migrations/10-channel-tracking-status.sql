-- 채널 운영 상태 (W01 수집 시 갱신)
-- active: 최근 90일 이내 업로드 있음
-- inactive: 채널 존재하나 90일 이상 미업로드 또는 영상 없음
-- untrackable: YouTube API에서 채널 조회 불가 (삭제·폐쇄·잘못된 ID)

ALTER TABLE channels ADD COLUMN IF NOT EXISTS tracking_status TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_upload_at TIMESTAMPTZ;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channels_tracking_status ON channels(tracking_status);

COMMENT ON COLUMN channels.tracking_status IS 'active | inactive | untrackable';
COMMENT ON COLUMN channels.last_upload_at IS '수집된 영상 중 가장 최근 published_at';
COMMENT ON COLUMN channels.status_checked_at IS 'tracking_status 마지막 판정 시각';
