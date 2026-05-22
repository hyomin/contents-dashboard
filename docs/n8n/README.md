# n8n 워크플로

로컬 Docker n8n 기준. JSON은 [workflows/](./workflows/) 에 있습니다.

## 활성 워크플로

스케줄 트리거는 **1일(`daysInterval: 1`)** 주기입니다. 즉시 실행은 Webhook·수동·대시보드 버튼을 사용하세요.

| JSON | Webhook | 설명 |
|------|---------|------|
| [N8N_YOUTUBE_COLLECT.json](./workflows/N8N_YOUTUBE_COLLECT.json) | `youtube-collect` | 채널·영상 수집 → Supabase |
| [N8N_OUTLIER_TAGGING.json](./workflows/N8N_OUTLIER_TAGGING.json) | `outlier-tagging` | vs.Avg 3x+ → `outlier_tags` 저장 |
| [N8N_RSS_TOPIC_COLLECT.json](./workflows/N8N_RSS_TOPIC_COLLECT.json) | `rss-topic-collect` | RSS → `rss_topic_candidates` 저장 |
| [N8N_NAVER_BLOG_VIEWS.json](./workflows/N8N_NAVER_BLOG_VIEWS.json) | `naver-blog-views` | 조회수·좋아요 → vs.Avg (대시보드 API 호출) |

## 보관 (미배포)

| JSON | 비고 |
|------|------|
| [N8N_TOPIC_SUGGEST.json](./workflows/N8N_TOPIC_SUGGEST.json) | LangChain(Claude) 노드 필요 — 재임포트 전 |

## 설치

```bash
# dashboard-app 루트
./scripts/n8n-setup.sh
```

동일 이름 워크플로가 2개 보이면 (재임포트 잔여):

```bash
./scripts/n8n-prune-duplicates.sh
```

운영 ID는 `lib/n8n/workflow-ids.ts` 참고.

`.env.local` 예시:

```env
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging
N8N_WEBHOOK_NAVER_BLOG_VIEWS=http://localhost:5678/webhook/naver-blog-views
DASHBOARD_API_URL=http://host.docker.internal:3000
```

**네이버 조회수 워크플로:** `npm run dev` 가 떠 있어야 n8n이 `POST /api/dashboard/naver-blog-views` 를 호출할 수 있습니다. `.env.local`에 `DASHBOARD_API_SECRET` 필수.

## API로 JSON 조회

- `GET /api/n8n/workflows/youtube`
- `GET /api/n8n/workflows/outlier`

코드 기준 현행 목록: `lib/n8n/live-workflows.ts`
