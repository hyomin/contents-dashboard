# Contents Dashboard

AI·데이터 기반 멀티플랫폼 콘텐츠 워크벤치.  
YouTube·블로그 레퍼런스 수집, vs.Avg·Outlier 분석, 콘텐츠 가이드·분석기·AI 생성까지 한 화면에서 연결합니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4 |
| Database | Supabase (PostgreSQL) |
| Automation | n8n (Docker) |
| AI | Google Gemini (n8n 경유 또는 직접 호출) |

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                    # http://localhost:3000/dashboard
```

### DB

[docs/migrations/00-schema-full.sql](./docs/migrations/00-schema-full.sql) — 최초 1회.  
추가 기능: [docs/migrations/README.md](./docs/migrations/README.md)

### n8n

```bash
docker compose -f docker-compose.n8n.yml --env-file .env.local up -d
./scripts/n8n-setup.sh
```

## 프로젝트 구조

```
dashboard-app/
├── app/                    # Next.js App Router, API
├── components/dashboard/   # 대시보드 UI
├── lib/
│   ├── n8n/               # 워크플로·Webhook
│   ├── data/              # Supabase·수집
│   └── dashboard/         # 네비·타입·비즈니스 로직
├── docs/                  # ← 문서 진입: docs/SUMMARY.md
├── guidelines/            # 콘텐츠 가이드라인 MD
└── scripts/
```

## 문서

| 문서 | 설명 |
|------|------|
| [docs/SUMMARY.md](./docs/SUMMARY.md) | **현황·우선순위** (먼저 읽기) |
| [docs/guides/DASHBOARD_OVERVIEW.md](./docs/guides/DASHBOARD_OVERVIEW.md) | 화면·API·DB 맵 |
| [docs/guides/DASHBOARD_USAGE.md](./docs/guides/DASHBOARD_USAGE.md) | 일상 사용법 |
| [docs/n8n/README.md](./docs/n8n/README.md) | n8n W01~W11 |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | 변경 이력 |

## 환경변수 (요약)

```env
NEXT_PUBLIC_SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
YOUTUBE_API_KEY=…
DASHBOARD_API_SECRET=…
GEMINI_API_KEY=…
DASHBOARD_GEMINI_DIRECT=1    # 콘텐츠 분석기 등 직접 호출
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
```

로그인: `DASHBOARD_LOGIN_ID` / `DASHBOARD_LOGIN_PASSWORD` + `node scripts/seed-dashboard-auth.mjs`

자세한 설명: [docs/SUMMARY.md](./docs/SUMMARY.md)
