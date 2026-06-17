# n8n 워크플로

로컬 Docker n8n 기준. JSON은 [workflows/](./workflows/) 에 있습니다.

코드 기준 현행 목록: `lib/n8n/live-workflows.ts` (W01~W10)  
설치: `./scripts/n8n-setup.sh`

스케줄 트리거는 **12시간마다** (`hoursInterval: 12`). 즉시 실행은 Webhook·수동·대시보드 버튼을 사용하세요.

## 활성 워크플로 (W01~W10)

| # | JSON | Webhook | 설명 |
|---|------|---------|------|
| W01 | [N8N_YOUTUBE_COLLECT.json](./workflows/N8N_YOUTUBE_COLLECT.json) | `youtube-collect` | 채널·영상 수집 → Supabase |
| W02 | [N8N_OUTLIER_TAGGING.json](./workflows/N8N_OUTLIER_TAGGING.json) | `outlier-tagging` | vs.Avg 3x+ → `outlier_tags` |
| W03 | [N8N_RSS_TOPIC_COLLECT.json](./workflows/N8N_RSS_TOPIC_COLLECT.json) | `rss-topic-collect` | RSS → `rss_topic_candidates` |
| W04 | [N8N_NAVER_BLOG_COLLECT.json](./workflows/N8N_NAVER_BLOG_COLLECT.json) | `naver-blog-collect` | 네이버 블로그 글 목록 |
| W05 | [N8N_TISTORY_COLLECT.json](./workflows/N8N_TISTORY_COLLECT.json) | `tistory-collect` | 티스토리 RSS |
| W06 | — | `notion-log` | Notion 자동화 로그 (후속 호출) |
| W07 | [N8N_NAVER_BLOG_VIEWS.json](./workflows/N8N_NAVER_BLOG_VIEWS.json) | `naver-blog-views` | 조회수·vs.Avg |
| W08 | [N8N_LONGFORM_SCRIPT.json](./workflows/N8N_LONGFORM_SCRIPT.json) | `longform-script` | 콘텐츠 가이드 AI (글·이미지·영상) |
| W09 | [N8N_TOPIC_SUGGEST_V2.json](./workflows/N8N_TOPIC_SUGGEST_V2.json) | `topic-suggest` | RSS+Outlier → 주제 5개 |
| W10 | [N8N_AI_INSIGHTS.json](./workflows/N8N_AI_INSIGHTS.json) | `ai-insights` | 수집 데이터 → 인사이트 JSON |

## 보관 (구버전·제거)

| JSON | 비고 |
|------|------|
| [N8N_TOPIC_SUGGEST.json](./workflows/N8N_TOPIC_SUGGEST.json) | LangChain — **V2로 대체** |
| `N8N_BGM_IDENTIFY.json` | **제거** — 콘텐츠 분석기 Gemini BGM 분석으로 대체 |

## 설치

```bash
cd dashboard-app
docker compose -f docker-compose.n8n.yml --env-file .env.local up -d
./scripts/n8n-setup.sh
```

동일 이름 워크플로 중복 시: `./scripts/n8n-prune-duplicates.sh`

`.env.local` 예시:

```env
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging
N8N_WEBHOOK_LONGFORM_SCRIPT=http://localhost:5678/webhook/longform-script
N8N_WEBHOOK_AI_INSIGHTS=http://localhost:5678/webhook/ai-insights
DASHBOARD_API_URL=http://host.docker.internal:3000
DASHBOARD_API_SECRET=…
```

**네이버 조회수·대시보드 API:** `npm run dev` 실행 중 + `DASHBOARD_API_SECRET` 필수.

## API로 JSON 조회

- `GET /api/n8n/workflows/youtube`
- `GET /api/n8n/workflows/outlier`
