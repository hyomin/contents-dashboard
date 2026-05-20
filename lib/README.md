# lib — 모듈 구조

## 디렉터리

| 경로 | 역할 |
|------|------|
| `n8n/` | n8n 현행 워크플로, 로드맵, Webhook URL, 배포 메타 |
| `data/` | Supabase 클라이언트, 쿼리, 수집, 아웃라이어 태깅, 포맷 |
| `dashboard/` | 네비, 타입, UI 헬퍼, localStorage 시드, 플랫폼·수집 설정 |

## import 규칙

- **신규 코드:** `@/lib/n8n/...`, `@/lib/data/...`, `@/lib/dashboard/...`
- **기존 경로:** `@/lib/queries` 등 루트 re-export 유지 (하위 호환)

## 예시

```ts
import { N8N_LIVE_WORKFLOWS } from '@/lib/n8n/live-workflows'
import { getOutlierVideos } from '@/lib/data/queries'
import { dashboardNav } from '@/lib/dashboard/dashboard-nav'
```
