# Contents Dashboard

AI-powered content analysis dashboard for YouTube, Instagram, and other social media platforms.

## 🚀 기술 스택

- **Frontend**: Next.js 16 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, Shadcn UI
- **Database**: PostgreSQL, Supabase
- **ORM**: Prisma
- **Deployment**: Vercel

## 📋 주요 기능

- YouTube/Instagram 콘텐츠 분석
- Outlier 감지 (vs. Avg 지표)
- 실시간 대시보드
- n8n 워크플로우 연동
- Apify 웹 스크래핑 통합

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

자세한 설정은 `SETUP_SUPABASE.md` 참고

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

### 4. 데이터베이스 마이그레이션

```bash
npx prisma migrate dev
```

## 📚 문서

- [GitHub 설정 가이드](./SETUP_GITHUB.md)
- [Supabase 설정 가이드](./SETUP_SUPABASE.md)
- [빠른 시작 가이드](./QUICK_START.md)

## 🗂️ 프로젝트 구조

```
dashboard-app/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 메인 페이지
│   └── api/               # API Routes
├── lib/                   # 유틸리티 함수
│   └── supabase.ts       # Supabase 클라이언트
├── prisma/               # 데이터베이스 스키마
│   └── schema.prisma
└── public/               # 정적 파일
```

## 🔗 배포

Vercel에서 원클릭 배포:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## 📄 라이선스

MIT

## 👤 작성자

hyomin
