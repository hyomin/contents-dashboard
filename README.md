# Contents Dashboard

AI 기반 멀티플랫폼 콘텐츠 분석 대시보드.  
YouTube 데이터를 자동 수집하고 vs.Avg 지표로 아웃라이어 콘텐츠를 발굴합니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Automation | n8n |
| API | YouTube Data API v3 |

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                    # http://localhost:3000/dashboard
```

### DB 초기화

Supabase SQL Editor에서 [docs/migrations/00-schema-full.sql](./docs/migrations/00-schema-full.sql) 실행.  
추가 기능만 필요하면 [docs/migrations/README.md](./docs/migrations/README.md) 순서 참고.

### n8n

```bash
docker compose -f docker-compose.n8n.yml --env-file .env.local up -d
./scripts/n8n-setup.sh
```

## 프로젝트 구조

```
dashboard-app/
├── app/                    # Next.js App Router, API routes
├── components/dashboard/   # 대시보드 UI
├── lib/
│   ├── n8n/                # 워크플로·로드맵·URL
│   ├── data/               # Supabase·쿼리·수집·태깅
│   └── dashboard/          # 네비·타입·헬퍼·설정
├── docs/
│   ├── SUMMARY.md          # ← 진행 사항 요약
│   ├── migrations/         # SQL
│   ├── n8n/workflows/      # n8n JSON
│   └── guides/             # 참고 자료
└── scripts/
    ├── n8n-setup.sh
    └── verify-youtube-pipeline.mjs
```

## 문서

| 문서 | 설명 |
|------|------|
| [docs/SUMMARY.md](./docs/SUMMARY.md) | **현재까지 진행 요약** |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | 변경 이력 |
| [docs/migrations/](./docs/migrations/) | Supabase SQL |
| [docs/n8n/](./docs/n8n/) | n8n 워크플로 |

## 환경변수 (요약)

```env
NEXT_PUBLIC_SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
YOUTUBE_API_KEY=…
DASHBOARD_API_SECRET=…
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging
```

로그인 계정은 `.env.local`의 `DASHBOARD_LOGIN_ID` / `DASHBOARD_LOGIN_PASSWORD` + `node scripts/seed-dashboard-auth.mjs` 로 등록합니다.

자세한 설명은 [docs/SUMMARY.md](./docs/SUMMARY.md) 참고.
