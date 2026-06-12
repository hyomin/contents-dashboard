# lib — 모듈 구조

## 디렉터리

| 경로 | 역할 |
|------|------|
| `n8n/` | n8n 워크플로 메타 (`live-workflows.ts`), Webhook 호출 |
| `data/` | Supabase 클라이언트, 쿼리, 수집, 아웃라이어 태깅 |
| `dashboard/` | 네비, 타입, n8n-AI, 콘텐츠 분석·가이드, env 보안 |
| `auth/` | 세션·로그인 레이트리밋 |
| `hooks/` | 클라이언트 훅 (히스토리 등) |

## import 규칙

```ts
import { N8N_LIVE_WORKFLOWS } from '@/lib/n8n/live-workflows'
import { getOutlierVideos } from '@/lib/data/queries'
import { VIEW_META } from '@/lib/dashboard/dashboard-nav'
import { buildContentAnalyzerPrompt } from '@/lib/dashboard/content-analyzer'
```

## 단일 진입점 (자주 쓰는 파일)

| 목적 | 파일 |
|------|------|
| 사이드바·화면 메타 | `dashboard/dashboard-nav.ts` |
| n8n 워크플로 목록 | `n8n/live-workflows.ts` |
| Gemini·n8n AI | `dashboard/n8n-ai.ts` |
| 콘텐츠 분석기 | `dashboard/content-analyzer.ts` |
| API 인증 | `dashboard/api-auth.ts` |
| 플랫폼 수집 상태 | `dashboard/platforms.ts` |

문서: [docs/SUMMARY.md](../docs/SUMMARY.md)
