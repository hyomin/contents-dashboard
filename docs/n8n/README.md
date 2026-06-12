# n8n 워크플로

로컬 Docker n8n 기준. JSON은 [workflows/](./workflows/) 에 있습니다.

코드 기준 현행 목록: `lib/n8n/live-workflows.ts`  
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

## 미연결 (W11)

| # | JSON | Webhook | 설명 | 상태 |
|---|------|---------|------|------|
| W11 | [N8N_BGM_IDENTIFY.json](./workflows/N8N_BGM_IDENTIFY.json) | `bgm-identify` | yt-dlp + AudD BGM 식별 | **코드·JSON 있음, `live-workflows.ts` 미등록, webhook 404** |

### W11 마무리 절차

```bash
# 1) https://dashboard.audd.io 에서 AUDD_API_TOKEN 발급
# 2) .env.local
AUDD_API_TOKEN=…
N8N_WEBHOOK_BGM_IDENTIFY=http://localhost:5678/webhook/bgm-identify

# 3) 컨테이너 재빌드 (yt-dlp·ffmpeg 포함)
unset GEMINI_API_KEY 2>/dev/null
docker compose -f docker-compose.n8n.yml --env-file .env.local up -d --build

# 4) 워크플로 import·활성화
./scripts/n8n-setup.sh

# 5) lib/n8n/live-workflows.ts 에 W11 항목 추가
```

대시보드 연동: `POST /api/dashboard/content-analyzer` → `invokeBgmIdentifyN8n()` 병렬 호출

## 보관 (구버전)

| JSON | 비고 |
|------|------|
| [N8N_TOPIC_SUGGEST.json](./workflows/N8N_TOPIC_SUGGEST.json) | LangChain — **V2로 대체** |

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
N8N_WEBHOOK_BGM_IDENTIFY=http://localhost:5678/webhook/bgm-identify
DASHBOARD_API_URL=http://host.docker.internal:3000
DASHBOARD_API_SECRET=…
AUDD_API_TOKEN=…
```

**네이버 조회수·대시보드 API:** `npm run dev` 실행 중 + `DASHBOARD_API_SECRET` 필수.

## API로 JSON 조회

- `GET /api/n8n/workflows/youtube`
- `GET /api/n8n/workflows/outlier`
