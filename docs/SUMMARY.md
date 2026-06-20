# Contents Dashboard — 현황 요약

**최종 갱신:** 2026-06-17  
**프로젝트 루트:** `dashboard-app/`  
**접속:** `http://localhost:3000/dashboard?view=<화면ID>`

> 상세 맵(화면·API·DB·n8n): [guides/DASHBOARD_OVERVIEW.md](./guides/DASHBOARD_OVERVIEW.md)  
> 일상 사용법·세팅: [guides/DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md)  
> A-Z 체크리스트: [guides/CONTENT_PRODUCTION_AZ_CHECKLIST.md](./guides/CONTENT_PRODUCTION_AZ_CHECKLIST.md)

---

## 한 줄 정의

**AI·데이터 기반 멀티플랫폼 콘텐츠 워크벤치** — 레퍼런스 수집·vs.Avg·Outlier → 기획·인사이트 → 가이드·분석기 → AI 생성 → 히스토리 → 제작·발행

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind 4 |
| DB | Supabase (PostgreSQL) |
| 자동화 | n8n (Docker, `localhost:5678`) |
| AI | Google Gemini — n8n 경유(기본) 또는 `DASHBOARD_GEMINI_DIRECT=1` 직접 호출 |
| 숏폼 영상 | OBS 녹화·스톡 영상 → 캡컷 수동 편집 |
| 인증 | `dashboard_app_users` + 세션 쿠키 + `DASHBOARD_API_SECRET` (프로덕션) |

---

## 지금 잘 되는 것

### YouTube 분석 (핵심 MVP)

- Supabase `channels` / `videos`, vs.Avg, S/A/B/C Tier, Shorts·롱폼(`format`)
- 롱폼 vs.Avg 분리 UI 토글 (`youtube-longform` / `my-youtube-longform`)
- 채널 카테고리·콘텐츠 스타일, 벌크 import, «내 채널» 필터
- Outlier 태깅 — `outlier_tags`, n8n W02 + API 폴백
- 수집 API: `collect`, `collect-all`, `collect-platform`

### 콘텐츠 만들기

| 화면 | view | 저장 |
|------|------|------|
| 콘텐츠 가이드 | `content-guide` | Supabase 히스토리 + localStorage |
| **콘텐츠 분석기** | `content-analyzer` | localStorage (분석 히스토리) |
| **제작 진행 보드** | `production-tracker` | localStorage |
| 발행 편집·변환 | `content-studio` | localStorage |
| 히스토리 관리 | `generation-history` | Supabase `content_generation_history` |

- 생성: n8n W08 `longform-script` 1순위 → `/api/dashboard/content-generate` 폴백
- 감정 톤(`emotionTone`)·숏폼 카테고리·Flow 씬별 붙여넣기 블록 지원
- 콘텐츠 분석기: Gemini 직접 시청(YouTube) + BGM 무드·식별·확보 가이드

### 기획·인사이트

- 트렌딩, Outlier, AI 인사이트(n8n W10), 주제 선별 AI(n8n W09)
- 기획 큐 → 가이드·레퍼런스 연동 (`planning-queue-v1`)
- 홈 = 로고 클릭 → `?view=overview`

### 운영·워크스페이스

- 네이버 블로그·티스토리 수집·분석
- 발행 확장: TikTok·Instagram·Blogger 가이드 (`publish-expand`)
- 캘린더, Repurpose, Deploy — Supabase + UI
- 로그인·middleware, `npm run verify:collect`, `npm run env:check`

### n8n (로컬 Docker)

- W01~W10: `live-workflows.ts` 등록·운영 (`./scripts/n8n-setup.sh`)
- 스케줄 수집: **12시간** 간격 (W01~W05, W07)

---

## 미완성·제한 사항

| 영역 | 상태 | 비고 |
|------|------|------|
| Instagram 레퍼런스 수집 | 발행 가이드만 | Business 계정 + Insights API 선행 |
| TikTok 레퍼런스 수집 | 발행 가이드만 | Apify 등 실수집 없음 — YouTube Shorts로 기획 |
| 수익 추적 | UI·추정치 | 실데이터 RPM 연동 없음 |
| 기간별 추이 차트 | 없음 | |
| n8n 인프라 | 로컬 Docker | PC 종료 시 W01~W10 스케줄·웹훅 중단 |
| 자동화 테스트 | `verify:collect`만 | Vitest/Playwright 없음 |
| 프로덕션 빌드 | `archive/` 포함 시 실패 | tsconfig에 `archive` exclude 권장 |
| DB 마이그레이션 15 | ⚠️ **미적용** | `apply-pending-20260617.sql` Supabase SQL Editor에서 실행 필요 |
| 미국 주식 시세 수집 | ⚠️ **ALPHA_VANTAGE_API_KEY 없음** | KR 종목은 정상, US(SPY/QQQ/AAPL/NVDA/MSFT) 데이터 없음 |
| n8n W11/W12 | Phase 2 미완 | 워크플로 JSON 미작성, 수동 API 호출로 임시 운영 가능 |

사이드바 배지 정의: `lib/dashboard/dashboard-nav.ts` (`NAV_PARTIAL_DUMMY_VIEW_IDS` 등)

---

## 사이드바 구조 (2026-06-12)

```
로고(홈=overview)

🔧 n8n — 로드맵 · 워크플로 관리
✨ 콘텐츠 만들기 — 가이드 · 분석기 · 제작 보드 · 발행 편집 · 히스토리
📝 채널 등록 — benchmark
📊 콘텐츠 분석 — YouTube(Shorts/롱폼) · 네이버 · 티스토리
💡 기획/인사이트 — 트렌딩 · Outlier · AI인사이트 · 주제선별
📺 내 채널 — 운영허브 · 캘린더 · 플랫폼별(내)
📤 발행 확장 — TikTok · Instagram · Blogger
⚙️ 파이프라인 — Repurpose · Deploy · 데이터수집
💰 수익 추적
설정: 헤더 ⚙
```

단일 소스: `lib/dashboard/dashboard-nav.ts` (`NAV_TREE`, `VIEW_META`)

---

## n8n 워크플로 (코드 기준)

| # | Webhook | 상태 |
|---|---------|------|
| W01 | `youtube-collect` | ✅ |
| W02 | `outlier-tagging` | ✅ |
| W03 | `rss-topic-collect` | ✅ |
| W04 | `naver-blog-collect` | ✅ |
| W05 | `tistory-collect` | ✅ |
| W06 | `notion-log` | ✅ (후속 호출) |
| W07 | `naver-blog-views` | ✅ |
| W08 | `longform-script` | ✅ |
| W09 | `topic-suggest` | ✅ |
| W10 | `ai-insights` | ✅ |

상세: [n8n/README.md](./n8n/README.md) · 코드: `lib/n8n/live-workflows.ts` (W01~W10)

---

## Supabase 마이그레이션

`docs/migrations/` — [README](./migrations/README.md)

| 파일 | 용도 |
|------|------|
| `00` | 전체 스키마 (최초 1회) |
| `01`~`12` | 워크스페이스·RSS·인증·히스토리 등 |
| `13` | 보안·성능 |
| `14` | 롱폼 vs_avg_longform·chapter_markers |
| `15` | channel_content_style |

---

## 환경변수 (핵심)

```env
NEXT_PUBLIC_SUPABASE_URL=…
SUPABASE_SERVICE_ROLE_KEY=…
YOUTUBE_API_KEY=…

# AI — 콘텐츠 분석기 등 직접 호출 시
GEMINI_API_KEY=…
DASHBOARD_GEMINI_DIRECT=1

# n8n (예시)
N8N_WEBHOOK_LONGFORM_SCRIPT=http://localhost:5678/webhook/longform-script
N8N_WEBHOOK_AI_INSIGHTS=http://localhost:5678/webhook/ai-insights
# DASHBOARD_API_SECRET=…  (프로덕션·n8n 연동)
```

| 용도 | URL |
|------|-----|
| 대시보드 | http://localhost:3000/dashboard |
| n8n | http://localhost:5678 |

---

## 다음 우선순위

1. **신규 기능 실사용 QA** — 콘텐츠 분석기·제작 진행 보드 URL 1건 end-to-end
2. **마이그레이션 14·15** Supabase 적용 확인
3. **n8n 클라우드/VPS 이전** 검토 (로컬 PC 종료 리스크)
4. Instagram Business 계정 전환 여부 확인
5. 숏폼 샘플 — OBS 녹화 클립으로 1편 캡컷 편집 후 업로드 확인

---

## 코드 단일 진입점

| 목적 | 파일 |
|------|------|
| 사이드바·헤더 | `lib/dashboard/dashboard-nav.ts` |
| 화면 라우팅 | `components/dashboard/DashboardPageContent.tsx` |
| n8n 워크플로 | `lib/n8n/live-workflows.ts` |
| 플랫폼·수집 | `lib/dashboard/platforms.ts` |
| 콘텐츠 가이드라인 | `guidelines/contents_guideline.md` |
| Agent 스냅샷 | `archive/agent-snapshots/` (Git 제외) |

---

## PC 이전 · 복구 체크

1. `dashboard-app` + `.env.local`
2. `npm install` → `npm run dev`
3. Supabase `00`~`15` 적용 확인
4. `docker compose -f docker-compose.n8n.yml --env-file .env.local up -d --build`
5. `./scripts/n8n-setup.sh`
6. 로그인 → 가이드 → 분석기 → 히스토리 동작 확인

---

## 관련 문서

| 문서 | 용도 |
|------|------|
| [DASHBOARD_OVERVIEW.md](./guides/DASHBOARD_OVERVIEW.md) | 화면·API·DB·n8n·파이프라인 전체 맵 |
| [DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md) | 일상 사용법·세팅·문제 해결 |
| [CONTENT_PRODUCTION_AZ_CHECKLIST.md](./guides/CONTENT_PRODUCTION_AZ_CHECKLIST.md) | A-Z 실행 체크리스트 |
| [CHANGELOG.md](./CHANGELOG.md) | 변경 이력 |

*구현이 바뀌면 `dashboard-nav.ts`, OVERVIEW, 이 SUMMARY를 함께 갱신하세요.*
