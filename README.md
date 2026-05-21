# Contents Dashboard

AI 기반 멀티플랫폼 콘텐츠 분석 대시보드.  
YouTube 데이터를 자동 수집하고 vs.Avg 지표로 아웃라이어 콘텐츠를 발굴합니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS, Shadcn UI |
| Database | Supabase (PostgreSQL) |
| Automation | n8n (YouTube 수집, AI 주제선별) |
| API | YouTube Data API v3 |

## 주요 기능

- **Overview** – 전체 플랫폼 요약 (vs.Avg 히트맵, 티어 분포)
- **플랫폼별 분석** – YouTube / Instagram / 네이버블로그 / 티스토리
- **아웃라이어 탐지** – vs.Avg 기반 이상치 영상 자동 탐지
- **트렌드 키워드** – 주간 키워드 트렌드 분석
- **AI 주제선별** – n8n + OpenAI 기반 콘텐츠 주제 자동 추천
- **벤치마킹** – 경쟁 채널 대비 성과 비교
- **수익/배포 자동화** – 수익화 지표 및 멀티플랫폼 배포 관리

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rxmqhkiepfqiaatopunb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
YOUTUBE_API_KEY=your-youtube-api-key
N8N_WEBHOOK_URL=http://localhost:5678/webhook/topic-suggest
```

### 3. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

### 4. 데이터베이스 초기화

Supabase SQL Editor에서 `docs/schema.sql` 실행

### 5. n8n 워크플로 설정

Docker로 n8n 실행:

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e YOUTUBE_API_KEY=your-key \
  -e SUPABASE_URL=https://rxmqhkiepfqiaatopunb.supabase.co \
  -e SUPABASE_SERVICE_KEY=your-service-role-key \
  -e N8N_BLOCK_ENV_ACCESS_IN_NODE=false \
  n8nio/n8n
```

n8n 접속 후 `docs/n8n/` 폴더의 JSON 파일 임포트:
- `N8N_YOUTUBE_COLLECT.json` – YouTube 채널/영상 데이터 자동 수집 (6시간 주기)
- `N8N_TOPIC_SUGGEST.json` – AI 기반 콘텐츠 주제 추천

## 프로젝트 구조

```
dashboard-app/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx            # 대시보드 메인 (뷰 라우팅)
│   │   └── layout.tsx          # 사이드바 레이아웃
│   └── api/
│       └── suggest-topic/      # n8n 주제선별 API
├── components/
│   └── dashboard/
│       ├── Sidebar.tsx
│       ├── ContentTable.tsx
│       ├── ToastContainer.tsx
│       └── views/              # 각 메뉴별 뷰 컴포넌트
├── lib/
│   ├── supabase.ts
│   ├── dashboard-types.ts
│   ├── dashboard-helpers.ts
│   └── dummy-data.ts
└── docs/
    ├── schema.sql              # Supabase 전체 스키마
    ├── PROGRESS.md             # 작업 진행 이력
    ├── FASTCAMPUS_LECTURE_ARXIV.md
    └── n8n/
        ├── N8N_YOUTUBE_COLLECT.json
        └── N8N_TOPIC_SUGGEST.json
```

## 문서

- [진행 상황](./docs/PROGRESS.md)
- [Supabase 스키마](./docs/schema.sql)
