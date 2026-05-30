# Contents Dashboard — 전체 현황 요약

> **목적:** 사이드바·각 화면·데이터·n8n 연동을 한 문서로 정리합니다. PC 이전·새 Agent 세션·기획 회고 시 **현재 형태**를 빠르게 파악할 수 있습니다.  
> **작성 기준일:** 2026-05-30  
> **프로젝트 루트:** `dashboard-app/`  
> **접속 URL:** `http://localhost:3000/dashboard?view=<화면ID>`

---

## 1. 프로젝트 한 줄 정의

**AI·데이터 기반 멀티플랫폼 콘텐츠 대시보드**

- 레퍼런스 채널·콘텐츠를 수집·분석하고 (**vs.Avg**, Outlier, RSS, 트렌드)
- 기획·인사이트로 주제를 좁힌 뒤
- **콘텐츠 가이드 → AI 생성 → 히스토리 → 콘텐츠 제작**까지 이어지는 워크벤치

| 구분 | 기술 |
|------|------|
| Frontend | Next.js App Router, React, TypeScript, Tailwind |
| DB | Supabase (PostgreSQL) |
| 자동화 | n8n (Docker, `localhost:5678`) |
| AI | Google Gemini (`GEMINI_API_KEY`) |
| 인증 | Supabase `dashboard_app_users` + 세션 쿠키 |

---

## 2. 화면 구조 (레이아웃)

```
┌─────────────────────────────────────────────────────────────┐
│ GlobalHeader: 로고(홈) · 설정 ⚙ · 세션 · 로그아웃              │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │ PageHeader (제목·설명)                            │
│ (w-60)   │ ─────────────────────────────────────────────── │
│          │ 각 View 컴포넌트 (본문)                           │
│ NAV_TREE │                                                  │
│          │                                                  │
│ 테마 토글 │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### 2.1 홈(개요)

- **사이드바 «전체 개요» 메뉴는 제거됨** → **로고 `📊 Contents` 클릭 = 홈**
- `?view=overview` → `OverviewView`
  - 플랫폼 통계, Outlier 미리보기, **AI 인사이트**(키워드 조회), 트렌딩 키워드
  - 인사이트 → **+ 기획** / **가이드 →** (기획 큐·콘텐츠 가이드 연동)

### 2.2 설정

- **사이드바에는 없음** → **상단 GlobalHeader ⚙** → `?view=settings`
- 테마, 알림, API 연결 상태, 과금·서비스 상태 등

### 2.3 라우팅 규칙

- 모든 화면: `/dashboard?view=<id>`
- 메타(제목·설명): `lib/dashboard/dashboard-nav.ts` → `VIEW_META`, `NAV_TREE` **단일 소스**
- 새 메뉴 추가 시 **dashboard-nav.ts** + `DashboardPageContent.tsx` switch + View 컴포넌트

---

## 3. 사이드바 전체 트리 (2026-05-30)

```
📊 Contents (로고 = overview 홈)

🔧 n8n [허브]
   ├ 🗺️ 자동화 로드맵          ?view=n8n-lv1
   └ ▶️ 워크플로 관리           ?view=automation

✨ 콘텐츠 만들기
   ├ 📋 콘텐츠 가이드           ?view=content-guide
   ├ ✍️ 콘텐츠 제작             ?view=content-studio
   └ 📚 히스토리 관리           ?view=generation-history

📝 채널 등록·관리 [핵심]
   └ ➕ 채널·콘텐츠 등록        ?view=benchmark

📊 콘텐츠 분석
   ├ 🔴 YouTube
   │    ├ ⚡ Shorts             ?view=youtube-shorts
   │    └ 🎬 롱폼               ?view=youtube-longform
   ├ 🎵 TikTok [더미]           ?view=tiktok
   ├ 💗 Instagram [준비중]
   │    ├ Reels                 ?view=instagram-reels
   │    └ 캐러셀                ?view=instagram-carousel
   ├ 🟢 네이버 블로그           ?view=naver-blog
   └ 🟠 티스토리                ?view=tistory

💡 기획 / 인사이트
   ├ 🔥 트렌딩 키워드           ?view=trending
   ├ 🚀 Outlier 분석            ?view=outlier
   ├ 🤖 AI 인사이트             ?view=ai-insight
   └ 🎯 주제 선별 AI [NEW]      ?view=topic-suggest

📺 내 채널 [허브]
   ├ 🏠 운영 허브               ?view=channels-mine
   ├ 🗓️ 콘텐츠 캘린더           ?view=calendar
   ├ 🔴 YouTube (내)
   │    ├ Shorts                ?view=my-youtube-shorts
   │    └ 롱폼                  ?view=my-youtube-longform
   ├ 🎵 TikTok [더미]           ?view=my-tiktok
   ├ 💗 Instagram [준비중] (내)
   ├ 🟢 네이버 블로그 (내)      ?view=my-naver-blog
   └ 🟠 티스토리 (내)           ?view=my-tistory

⚙️ 파이프라인
   ├ 🔄 Repurposing             ?view=repurpose
   ├ 📤 배포 자동화             ?view=deploy
   └ 🤖 데이터 수집             ?view=data-collect

💰 수익 추적                   ?view=revenue

(하단) 테마: Light · Soft · Dark · System
```

**그룹 클릭만 하는 메뉴** (`NAV_EXPAND_ONLY_IDS`): n8n, create, channel-register, analysis, insights, my-channels, pipeline — 자식 화면만 이동

---

## 4. 메뉴별 서비스 내용

### 4.1 🔧 n8n

| 화면 | view | 하는 일 | 데이터 |
|------|------|---------|--------|
| **자동화 로드맵** | `n8n-lv1` | Research 1·2·3단계 로드맵, 카드별 n8n 시나리오·실행 | 로드맵 정적 + n8n 상태 |
| **워크플로 관리** | `automation` | W01~W09 Webhook 프로브, 수동 실행, 연동 API 안내 | n8n Docker + `live-workflows.ts` |

**운영 워크플로 (W01~W09):** `lib/n8n/live-workflows.ts` · `./scripts/n8n-setup.sh`

---

### 4.2 ✨ 콘텐츠 만들기

| 화면 | view | 하는 일 | 저장 |
|------|------|---------|------|
| **콘텐츠 가이드** | `content-guide` | 발행 주제(필수)·레퍼런스(선택)·급상승/RSS·기획 큐·AI 스크립트 생성·내 콘텐츠화 | Supabase 히스토리 + localStorage(주제·레퍼런스) |
| **콘텐츠 제작** | `content-studio` | 발행용 제목·본문·메모 편집, AI 포맷 변환 | 브라우저 localStorage |
| **히스토리 관리** | `generation-history` | 생성 **원본** + **내 콘텐츠화** 검색·필터·재활용 | **Supabase** `content_generation_history` |

**상세 복구 가이드:** [`CONTENT_CREATION_PIPELINE_RECOVERY.md`](./CONTENT_CREATION_PIPELINE_RECOVERY.md)

**콘텐츠 가이드 핵심 흐름:**

1. ✍️ 발행 주제 입력 (예: 삼성전자 단기 전망)
2. (선택) 참고 레퍼런스 — 구조·톤만
3. 글쓰기/이미지/영상 탭 → 스크립트 가이드 생성 (n8n Gemini → 실패 시 대시보드 Gemini)
4. ✨ 내 콘텐츠화 — 레퍼런스 흔적 제거, 블로그는 **이미지·표 가이드 텍스트** 삽입 (이미지 파일 자동 생성 없음)
5. 콘텐츠 제작 → 또는 히스토리 관리에서 나중에 확인

---

### 4.3 📝 채널 등록·관리

| 화면 | view | 하는 일 |
|------|------|---------|
| **채널·콘텐츠 등록** | `benchmark` | YouTube·네이버·티스토리 등 **분석 대상 채널** 검색·등록, 벌크 import, 카테고리 지정, 수집 트리거 |

- 등록된 채널 → Supabase `channels`
- 콘텐츠 → `videos` (플랫폼별 `video_id`, 조회수, vs.Avg, format 등)

---

### 4.4 📊 콘텐츠 분석 (레퍼런스·벤치마크)

**공통:** `PlatformView` — 등록 채널의 콘텐츠 테이블, vs.Avg, Tier, 카테고리 필터, 영상 상세 모달

| 화면 | view | 플랫폼 | 수집 | 비고 |
|------|------|--------|------|------|
| YouTube / Shorts / 롱폼 | `youtube*` | youtube | ✅ | format short/long 분리 |
| 네이버 블로그 | `naver-blog` | naver-blog | ✅ | Open API + 조회수 갱신 |
| 티스토리 | `tistory` | tistory | ✅ | RSS |
| TikTok | `tiktok` | tiktok | ⚠️ 더미 | Apify 연동 예정 |
| Instagram | `instagram*` | instagram | 🚧 준비중 | UI만 |

**허브 화면:** `?view=analysis` → `AnalysisHubView` (플랫폼 탭 한 화면)

**플랫폼 상태 정의:** `lib/dashboard/platforms.ts`

---

### 4.5 💡 기획 / 인사이트

| 화면 | view | 하는 일 | API·데이터 |
|------|------|---------|-------------|
| **트렌딩 키워드** | `trending` | 수집 영상 기반 급상승 키워드 순위 | `/api/dashboard/trending` |
| **Outlier 분석** | `outlier` | vs.Avg 3x+ 고성과 콘텐츠, 자동 태깅 | `videos`, `outlier_tags`, n8n W02 |
| **AI 인사이트** | `ai-insight` | Gemini 기반 기획 추천 (섹션별) | `/api/dashboard/insights` |
| **주제 선별 AI** | `topic-suggest` | RSS+Outlier → 추천 주제 5개 | n8n W09, `/api/topic-suggest` |

**기획 큐:** 여러 화면에서 `+ 기획` → localStorage `planning-queue-v1` → 콘텐츠 가이드에서 **주제** 또는 **레퍼런스**로 연결

**개요(홈) AI 인사이트:** 키워드 입력 → scoped 인사이트 조회 → 가이드 이동 시 `?topic=` 전달

---

### 4.6 📺 내 채널 (운영)

| 화면 | view | 하는 일 |
|------|------|---------|
| **운영 허브** | `channels-mine` | «내 채널»(`is_mine`) 지정, 구독자·목표, 플랫폼별 바로가기 |
| **콘텐츠 캘린더** | `calendar` | 제작·업로드 일정 (idea/draft/scheduled 등) |
| **내 YouTube / 블로그 / …** | `my-*` | **내 채널만** 필터된 `PlatformView` (`mineOnly: true`) |

**워크스페이스 DB:** `channel_flags`, `calendar_items` (Supabase)

---

### 4.7 ⚙️ 파이프라인

| 화면 | view | 하는 일 | 상태 |
|------|------|---------|------|
| **Repurposing** | `repurpose` | Outlier 콘텐츠 → 멀티플랫폼 재가공 태스크 | Supabase `repurpose_items` + UI |
| **배포 자동화** | `deploy` | n8n 기반 멀티채널 배포 예약 | Supabase `deploy_tasks` + UI |
| **데이터 수집** | `data-collect` | collect-all, 플랫폼별 수집, Notion sync, 품질 점검 | API + n8n W01~W07 |

---

### 4.8 💰 수익 추적

| 화면 | view | 하는 일 |
|------|------|---------|
| **수익 추적** | `revenue` | 플랫폼별 수익·로드맵 (로드맵·UI 중심) |

---

### 4.9 ⚙️ 설정 (헤더)

| 화면 | view | 하는 일 |
|------|------|---------|
| **설정** | `settings` | 테마, 토스트 알림, Gemini·Supabase·n8n 연결 상태, API 키 마스킹 표시 |

---

## 5. 플랫폼·데이터 성숙도

| 표시 | 의미 | 해당 메뉴 |
|------|------|-----------|
| (없음) | 실데이터·수집 연동 | YouTube, 네이버, 티스토리, Outlier, 대부분 n8n |
| **(일부 더미)** | API+localStorage 혼합 | content-guide, automation, n8n-lv1 |
| **[더미]** | UI 미리보기만 | TikTok |
| **[준비중]** | UI shell | Instagram |
| **ComingSoon** | `PlatformView` 접근 제한 | instagram 계열 |

정의: `NAV_PARTIAL_DUMMY_VIEW_IDS`, `lib/dashboard/platforms.ts`

---

## 6. 데이터 저장소 맵

### 6.1 Supabase (영구·기기 공유)

| 테이블 | 용도 |
|--------|------|
| `channels`, `videos` | 채널·콘텐츠·vs.Avg·format |
| `channel_categories`, `channel_flags` | 카테고리·내 채널·추적 |
| `outlier_tags` | Outlier 자동 태깅 |
| `rss_topic_candidates` | RSS 주제 수집 |
| `calendar_items`, `repurpose_items`, `deploy_tasks` | 워크스페이스 |
| `saved_shorts` | 저장한 Shorts |
| `content_generation_history` | **생성 히스토리** (draft + polished) |
| `dashboard_app_users` | 로그인 |

마이그레이션: `docs/migrations/` (`00`~`11`)

### 6.2 localStorage (브라우저·기기 종속)

| 키 | 용도 |
|----|------|
| `guide-publish-topic-v1` | 발행 주제 |
| `dashboard_guide_references` | 가이드 레퍼런스 |
| `planning-queue-v1` | 기획 큐 |
| `content-studio-import-v1` | 가이드→제작 1회 임포트 |
| 콘텐츠 제작 본문 | ContentStudioView 내부 저장 |

---

## 7. n8n ↔ 대시보드 연동表

| No | Webhook | 이름 | 스케줄 | 연결 화면 |
|----|---------|------|--------|-----------|
| W01 | `youtube-collect` | YouTube 수집 | 12h | data-collect, my-youtube |
| W02 | `outlier-tagging` | Outlier 태깅 | 12h | outlier |
| W03 | `rss-topic-collect` | RSS 주제 | 12h | content-guide |
| W04 | `naver-blog-collect` | 네이버 글 목록 | 12h | naver-blog, data-collect |
| W05 | `tistory-collect` | 티스토리 RSS | 12h | tistory, data-collect |
| W06 | (내장) | Notion 로그 | 워크플로 후속 | data-collect |
| W07 | `naver-blog-views` | 네이버 조회수 | 12h | naver-blog |
| W08 | `longform-script` | 롱폼/블로그 AI | 수동 | content-guide, content-studio |
| W09 | `topic-suggest` | 주제 선별 AI | 수동 | topic-suggest, content-guide |

**기동:** `docker compose -f docker-compose.n8n.yml --env-file .env.local up -d` + `./scripts/n8n-setup.sh`

---

## 8. 핵심 API (대표)

| 경로 | 용도 |
|------|------|
| `POST /api/dashboard/collect-all` | 전체 채널 수집 |
| `POST /api/dashboard/collect-platform` | 플랫폼별 수집 |
| `GET/POST /api/dashboard/rss-topics` | RSS 주제 |
| `GET /api/dashboard/trending` | 트렌딩 키워드 |
| `GET /api/dashboard/insights?keywords=` | AI 인사이트 (키워드 범위) |
| `POST /api/dashboard/script-guide` | 콘텐츠 가이드 생성 |
| `POST /api/dashboard/content-polish` | 내 콘텐츠화 |
| `GET/POST/PATCH/DELETE /api/dashboard/generation-history` | 히스토리 CRUD |
| `POST /api/dashboard/content-generate` | Gemini 직접 생성 (n8n 폴백) |
| `POST /api/topic-suggest` | 주제 선별 |

프로덕션: `DASHBOARD_API_SECRET` + middleware (`middleware.ts`)

---

## 9. 추천 일과 (운영 관점)

```
아침/기획
  └ n8n RSS·YouTube 수집 (또는 data-collect 수동)
  └ 개요 / 트렌딩 / Outlier / 주제 선별 AI
  └ 발행 주제 결정 → 콘텐츠 가이드

제작
  └ 스크립트 생성 → Supabase 원본 저장
  └ 내 콘텐츠화 → 히스토리에 정재본
  └ 콘텐츠 제작에서 최종 편집
  └ (블로그) 이미지 가이드 보고 직접 삽입 후 발행

운영
  └ 내 채널 / 캘린더로 일정 관리
  └ Repurpose·Deploy (로드맵)
```

---

## 10. 소스 파일 · 설정 단일 진입점

| 목적 | 파일 |
|------|------|
| **사이드바·헤더 메타** | `lib/dashboard/dashboard-nav.ts` |
| 화면 라우팅 | `components/dashboard/DashboardPageContent.tsx` |
| 사이드바 UI | `components/dashboard/Sidebar.tsx` |
| n8n 워크플로 목록 | `lib/n8n/live-workflows.ts` |
| n8n 로드맵 | `lib/n8n/research-roadmap.ts` |
| 플랫폼 수집 여부 | `lib/dashboard/platforms.ts` |
| 환경변수 예시 | `.env.example` |
| 콘텐츠 생성 복구 | `docs/guides/CONTENT_CREATION_PIPELINE_RECOVERY.md` |

---

## 11. PC 이전 · Agent 복구 체크리스트

1. `dashboard-app` + `.env.local` 복사
2. `npm install` → `npm run dev`
3. Supabase 마이그레이션 `00`~`11` 적용 여부 확인
4. n8n Docker + `./scripts/n8n-setup.sh`
5. `./scripts/verify-script-guide.sh` (선택)
6. 로그인 → 로고(개요) → 콘텐츠 가이드 → 히스토리 관리 동작 확인

---

## 12. 변경 이력 (메모)

| 날짜 | 내용 |
|------|------|
| 2026-05-30 | 히스토리 관리 메뉴, 발행 주제 필수, Supabase 히스토리, 개요=로고 홈 |
| 2026-05-30 | 본 문서 최초 작성 |

---

*구현이 바뀌면 `dashboard-nav.ts`와 이 문서를 함께 갱신하세요.*
