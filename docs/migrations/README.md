# Supabase 마이그레이션

Supabase **SQL Editor**에서 아래 순서대로 실행합니다.  
모든 파일은 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` 로 **반복 실행 가능**합니다.

## 실행 순서

| 순서 | 파일 | 내용 |
|------|------|------|
| 0 | [00-schema-full.sql](./00-schema-full.sql) | 전체 스키마 (users, channels, videos, benchmarks, workspace, saved_shorts, outlier_tags, 인덱스) |
| 1 | [01-workspace.sql](./01-workspace.sql) | channel_flags, calendar_items, repurpose_items, deploy_tasks (`00`에 없을 때만) |
| 2 | [02-channel-categories.sql](./02-channel-categories.sql) | channel_categories + channels.category_id |
| 3 | [03-video-format.sql](./03-video-format.sql) | videos.format, saved_shorts |
| 4 | [04-outlier-tags.sql](./04-outlier-tags.sql) | outlier_tags (아웃라이어 자동 태깅) |
| 5 | [05-rss-topic-candidates.sql](./05-rss-topic-candidates.sql) | rss_topic_candidates (RSS 주제 수집) |

## 권장

- **새 프로젝트**: `00-schema-full.sql` 한 번만 실행하면 대부분 충분합니다.
- **기존 DB**: `00` 적용 후 추가된 기능만 `01`~`04`에서 골라 실행.

## 이전 경로 (deprecated)

루트 `docs/` 에 있던 파일명은 아래로 이동했습니다.

| 이전 | 현재 |
|------|------|
| `docs/schema.sql` | `docs/migrations/00-schema-full.sql` |
| `docs/supabase-workspace-migration.sql` | `docs/migrations/01-workspace.sql` |
| `docs/supabase-channel-categories-migration.sql` | `docs/migrations/02-channel-categories.sql` |
| `docs/supabase-video-format-migration.sql` | `docs/migrations/03-video-format.sql` |
| `docs/supabase-outlier-tags-migration.sql` | `docs/migrations/04-outlier-tags.sql` |
