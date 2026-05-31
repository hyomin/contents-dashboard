# Contents Dashboard — 진행 사항 요약

**최종 갱신:** 2026-05-31  
**프로젝트 루트:** `dashboard-app/`  
**접속:** `http://localhost:3000/dashboard?view=<화면ID>`

> **상세 현황(사이드바 전체·화면별·API·DB 맵):** [guides/DASHBOARD_OVERVIEW_20260530.md](./guides/DASHBOARD_OVERVIEW_20260530.md)  
> **콘텐츠 생성 파이프라인 복구:** [guides/CONTENT_CREATION_PIPELINE_RECOVERY.md](./guides/CONTENT_CREATION_PIPELINE_RECOVERY.md)

---

## 한 줄 정의

**AI·데이터 기반 멀티플랫폼 콘텐츠 워크벤치** — 레퍼런스 수집·**vs.Avg**·Outlier 분석 → 기획·인사이트 → **콘텐츠 가이드 → AI 생성 → 히스토리 → 제작**

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind 4 |
| DB | Supabase (PostgreSQL) |
| 자동화 | n8n (Docker, `localhost:5678`) |
| AI | Google Gemini (`GEMINI_API_KEY`) |
| 인증 | `dashboard_app_users` + 세션 쿠키 + `DASHBOARD_API_SECRET` (프로덕션) |

---

## 지금 잘 되는 것

### YouTube 분석 (핵심 MVP)

- Supabase `channels` / `videos`, vs.Avg, S/A/B/C Tier, Shorts·롱폼(`format`)
- 채널 카테고리, 벌크 import, «내 채널»(`is_mine`) 필터
- Outlier 태깅 — `outlier_tags`, n8n W02 + API 폴백
- 수집 API: `collect`, `collect-all`, `collect-platform`

### 콘텐츠 만들기 파이프라인

- **콘텐츠 가이드** (`content-guide`) — 발행 주제, 레퍼런스, 스크립트 생성, 내 콘텐츠화
- **히스토리 관리** (`generation-history`) — Supabase `content_generation_history` (draft + polished)
- **콘텐츠 제작** (`content-studio`) — localStorage 편집
- 생성: n8n `longform-script` 1순위 → `/api/dashboard/content-generate` 폴백

### 기획·인사이트

- 트렌딩, Outlier, AI 인사이트(Gemini), 주제 선별 AI(`/api/topic-suggest`)
- 기획 큐 → 가이드·레퍼런스 연동 (`planning-queue-v1`)
- 개요(홈) = 로고 클릭, `?view=overview`

### 운영·워크스페이스

- 캘린더, Repurpose, Deploy — Supabase 테이블 + UI
- 네이버 블로그·티스토리 수집·분석 (YouTube 다음으로 성숙)
- 로그인·middleware, `npm run verify:collect`

### n8n (로컬)

- W01 YouTube 수집, W02 Outlier 태깅 등 — `./scripts/n8n-setup.sh`
- «구현됨» = Webhook 404 아님 (`live-workflows.ts`)

---

## 아직 부분·더미

| 영역 | 상태 |
|------|------|
| TikTok | UI + 더미 데이터 |
| Instagram | 준비 중 shell |
| 수익 추적 | 로드맵·UI 중심 |
| 기간별 추이 차트 | 없음 |
| n8n 클라우드·Vercel cron | 로컬 Docker 의존 → **PC 종료 시 스케줄 중단** |
| 자동화 테스트 | `verify:collect`만, Vitest/Playwright 없음 |

사이드바 **(더미)** / **[준비중]** 배지: `lib/dashboard/dashboard-nav.ts`

---

## 사이드바 요약 (2026-05-30 기준)

```
로고(홈=overview)
├ n8n: 로드맵 · 워크플로 관리
├ 콘텐츠 만들기: 가이드 · 제작 · 히스토리
├ 채널 등록: benchmark
├ 콘텐츠 분석: YouTube(실) · TikTok(더미) · IG(준비) · 네이버·티스토리(실)
├ 기획: 트렌딩 · Outlier · AI인사이트 · 주제선별
├ 내 채널: 운영허브 · 캘린더 · 플랫폼별(내)
├ 파이프라인: Repurpose · Deploy · 데이터수집
└ 수익 추적
설정: 헤더 ⚙ → settings
```

화면별 상세·API·localStorage 키 → [DASHBOARD_OVERVIEW](./guides/DASHBOARD_OVERVIEW_20260530.md)

---

## Supabase 마이그레이션

`docs/migrations/` — [README](./migrations/README.md)

| 파일 | 용도 |
|------|------|
| `00` | 전체 스키마 (최초 1회) |
| `01` | 워크스페이스 (캘린더·리퍼포즈·배포) |
| `02` | 채널 카테고리 |
| `03` | Shorts/롱폼·saved_shorts |
| `04` | outlier_tags |
| `05`~`09` | RSS·Notion·인증·추적 등 |
| `10` | channel_tracking_status |
| `11` | content_generation_history |
| `12` | topic_keyword_guide_history |

---

## 코드·설정 단일 진입점

| 목적 | 파일 |
|------|------|
| 사이드바·헤더 | `lib/dashboard/dashboard-nav.ts` |
| 화면 라우팅 | `components/dashboard/DashboardPageContent.tsx` |
| n8n 워크플로 | `lib/n8n/live-workflows.ts` |
| 플랫폼 수집 여부 | `lib/dashboard/platforms.ts` |
| Agent 스냅샷 | `archive/agent-snapshots/` (Git 제외) |

---

## 환경·로컬 접속

```env
# .env.local — 예시 키만, 값은 저장소에 없음
NEXT_PUBLIC_SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
YOUTUBE_API_KEY=…
GEMINI_API_KEY=…
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging
# DASHBOARD_API_SECRET=…  (프로덕션)
```

| 용도 | URL |
|------|-----|
| 대시보드 | http://localhost:3000/dashboard |
| n8n | http://localhost:5678 |

---

## 다음 우선순위 (운영·로드맵)

1. **보안** — API 키 로테이션, 프로덕션 시크릿
2. **멀티플랫폼** — TikTok/Instagram 실수집 (Apify 등)
3. **운영** — n8n·cron 클라우드 이전 (로컬 종료 리스크 해소)
4. **품질** — vs.Avg·수집 단위 테스트
5. **문서** — 구현 변경 시 `dashboard-nav.ts` + OVERVIEW + 이 SUMMARY 동시 갱신

6단계 전개(분석 → 멀티플랫폼 → AI 기획 → 생성·배포): [PROJECT_REPORT_20260524.md](./PROJECT_REPORT_20260524.md)

---

## PC 이전 · Agent 복구 (짧은 체크)

1. `dashboard-app` + `.env.local`
2. `npm install` → `npm run dev`
3. Supabase `00`~`12` 적용 확인
4. n8n Docker + `./scripts/n8n-setup.sh`
5. 로그인 → 가이드 → 히스토리 동작 확인

---

## 관련 문서

| 문서 | 용도 |
|------|------|
| [DASHBOARD_OVERVIEW_20260530.md](./guides/DASHBOARD_OVERVIEW_20260530.md) | 화면·API·DB·n8n **전체 맵** |
| [CONTENT_CREATION_PIPELINE_RECOVERY.md](./guides/CONTENT_CREATION_PIPELINE_RECOVERY.md) | 생성 파이프라인 복구 |
| [DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md) | 사용법·타이밍 |
| [CHANGELOG.md](./CHANGELOG.md) | 날짜별 이력 |
| [PROJECT_REPORT_20260524.md](./PROJECT_REPORT_20260524.md) | 투자·Gemini·우선순위 |

---

*구현이 바뀌면 `dashboard-nav.ts`, OVERVIEW, 이 SUMMARY를 함께 갱신하세요.*
