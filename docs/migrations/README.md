# Supabase 마이그레이션

Supabase **SQL Editor**에서 아래 순서대로 실행합니다.  
모든 파일은 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` 로 **반복 실행 가능**합니다.

## 실행 순서

| 순서 | 파일 | 내용 |
|------|------|------|
| 0 | [00-schema-full.sql](./00-schema-full.sql) | 전체 스키마 (users, channels, videos, workspace, outlier_tags 등) |
| 1 | [01-workspace.sql](./01-workspace.sql) | calendar_items, repurpose_items, deploy_tasks |
| 2 | [02-channel-categories.sql](./02-channel-categories.sql) | channel_categories + channels.category_id |
| 3 | [03-video-format.sql](./03-video-format.sql) | videos.format, saved_shorts |
| 4 | [04-outlier-tags.sql](./04-outlier-tags.sql) | outlier_tags |
| 5 | [05-rss-topic-candidates.sql](./05-rss-topic-candidates.sql) | rss_topic_candidates |
| 6 | [06-dashboard-auth.sql](./06-dashboard-auth.sql) | dashboard_app_users |
| 7 | [07-notion-daily-logs.sql](./07-notion-daily-logs.sql) | Notion 로그 |
| 8 | [08-rss-topic-ai-columns.sql](./08-rss-topic-ai-columns.sql) | RSS AI 컬럼 |
| 9 | [09-rss-sources.sql](./09-rss-sources.sql) | RSS 소스 |
| 10 | [10-channel-tracking-status.sql](./10-channel-tracking-status.sql) | 채널 추적 상태 |
| 11 | [11-content-generation-history.sql](./11-content-generation-history.sql) | 생성 히스토리 |
| 12 | [12-topic-keyword-guide-history.sql](./12-topic-keyword-guide-history.sql) | 주제 키워드 가이드 히스토리 |
| 13 | [13-security-and-perf.sql](./13-security-and-perf.sql) | 보안·성능 |
| 14 | [14-longform-carousel-metrics.sql](./14-longform-carousel-metrics.sql) | vs_avg_longform, chapter_markers |
| 15 | [15-channel-content-style.sql](./15-channel-content-style.sql) | channel_content_style |

## 권장

- **새 프로젝트:** `00-schema-full.sql` 한 번만 실행하면 대부분 충분합니다.
- **기존 DB:** `00` 적용 후 추가된 기능만 `01`~`15`에서 골라 실행.

## 적용 확인 (14·15)

Supabase SQL Editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'videos' AND column_name IN ('vs_avg_longform', 'avg_views_longform');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'channels' AND column_name = 'channel_content_style';
```

결과가 없으면 해당 마이그레이션 파일을 실행하세요.
