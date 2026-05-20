# n8n 워크플로

로컬 Docker n8n 기준. JSON은 [workflows/](./workflows/) 에 있습니다.

## 활성 워크플로 (2026-05-20 기준)

| JSON | Webhook | 설명 |
|------|---------|------|
| [N8N_YOUTUBE_COLLECT.json](./workflows/N8N_YOUTUBE_COLLECT.json) | `youtube-collect` | 채널·영상 수집 → Supabase |
| [N8N_OUTLIER_TAGGING.json](./workflows/N8N_OUTLIER_TAGGING.json) | `outlier-tagging` | vs.Avg 3x+ → `outlier_tags` 저장 |

## 보관 (미배포)

| JSON | 비고 |
|------|------|
| [N8N_TOPIC_SUGGEST.json](./workflows/N8N_TOPIC_SUGGEST.json) | LangChain(Claude) 노드 필요 — 재임포트 전 |

## 설치

```bash
# dashboard-app 루트
./scripts/n8n-setup.sh
```

`.env.local` 예시:

```env
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging
```

## API로 JSON 조회

- `GET /api/n8n/workflows/youtube`
- `GET /api/n8n/workflows/outlier`

코드 기준 현행 목록: `lib/n8n/live-workflows.ts`
