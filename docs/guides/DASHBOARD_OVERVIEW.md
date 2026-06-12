# Contents Dashboard — 전체 현황 (상세)

> **빠른 요약:** [SUMMARY.md](../SUMMARY.md)  
> **작성 기준일:** 2026-06-12  
> **프로젝트 루트:** `dashboard-app/`  
> **접속:** `http://localhost:3000/dashboard?view=<화면ID>`

---

## 1. 프로젝트 정의

**AI·데이터 기반 멀티플랫폼 콘텐츠 워크벤치**

- 레퍼런스 채널·콘텐츠 수집·분석 (vs.Avg, Outlier, RSS, 트렌드)
- 기획·인사이트로 주제 선정
- **콘텐츠 가이드 → 분석기 → AI 생성 → 히스토리 → 제작·발행**

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4 |
| DB | Supabase (PostgreSQL) |
| 자동화 | n8n (Docker) |
| AI | Gemini — n8n Webhook 우선, `DASHBOARD_GEMINI_DIRECT=1` 시 직접 호출 |
| 인증 | 세션 쿠키 + `DASHBOARD_API_SECRET` |

---

## 2. 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ GlobalHeader: 로고(홈) · 설정 ⚙ · 세션 · 로그아웃              │
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │ PageHeader (제목·설명)                            │
│ NAV_TREE │ 각 View 컴포넌트 (next/dynamic lazy-load)        │
└──────────┴──────────────────────────────────────────────────┘
```

- **홈:** 로고 클릭 → `?view=overview` (사이드바 «전체 개요» 메뉴 없음)
- **설정:** 헤더 ⚙ → `?view=settings`
- **라우팅:** `/dashboard?view=<id>`
- **메타 단일 소스:** `lib/dashboard/dashboard-nav.ts`

---

## 3. 사이드바 전체 트리

```
📊 Contents (로고 = overview)

🔧 n8n
   ├ 🗺️ 자동화 로드맵          ?view=n8n-lv1
   └ ▶️ 워크플로 관리           ?view=automation

✨ 콘텐츠 만들기
   ├ 📋 콘텐츠 가이드           ?view=content-guide
   ├ 🔍 콘텐츠 분석기           ?view=content-analyzer
   ├ 🗂️ 제작 진행 보드          ?view=production-tracker
   ├ ✍️ 발행 편집·변환          ?view=content-studio
   └ 📚 히스토리 관리           ?view=generation-history

📝 채널 등록·관리
   └ ➕ 채널·콘텐츠 등록        ?view=benchmark

📊 콘텐츠 분석
   ├ 🔴 YouTube
   │    ├ ⚡ Shorts             ?view=youtube-shorts
   │    └ 🎬 롱폼               ?view=youtube-longform
   ├ 🟢 네이버 블로그           ?view=naver-blog
   └ 🟠 티스토리                ?view=tistory

💡 기획 / 인사이트
   ├ 🔥 트렌딩 키워드           ?view=trending
   ├ 🚀 Outlier 분석            ?view=outlier
   ├ 🤖 AI 인사이트             ?view=ai-insight
   └ 🎯 주제 선별 AI            ?view=topic-suggest

📺 내 채널
   ├ 🏠 운영 허브               ?view=channels-mine
   ├ 🗓️ 콘텐츠 캘린더           ?view=calendar
   ├ 🔴 YouTube (내 Shorts/롱폼)
   ├ 🎵 TikTok · 💗 Instagram · 🌐 Blogger (발행)
   ├ 🟢 네이버 블로그 (내)
   └ 🟠 티스토리 (내)

📤 발행 확장
   ├ 🎵 TikTok                  ?view=tiktok
   ├ 💗 Instagram (Reels/캐러셀)
   └ 🌐 Google Blogger          ?view=blogger

⚙️ 파이프라인
   ├ 🔄 Repurposing             ?view=repurpose
   ├ 📤 배포 자동화             ?view=deploy
   └ 🤖 데이터 수집             ?view=data-collect

💰 수익 추적                   ?view=revenue
```

**그룹 전용(id만, 화면 없음):** `n8n`, `create`, `channel-register`, `analysis`, `insights`, `my-channels`, `pipeline`, `publish-expand`

---

## 4. 메뉴별 상세

### 4.1 n8n

| 화면 | view | 하는 일 |
|------|------|---------|
| 자동화 로드맵 | `n8n-lv1` | Research 1·2·3단계 로드맵, 카드별 실행 |
| 워크플로 관리 | `automation` | W01~W10 Webhook 프로브·수동 실행 |

코드 목록: `lib/n8n/live-workflows.ts` (W11은 코드·JSON만 있고 **미등록**)

### 4.2 콘텐츠 만들기

| 화면 | view | 하는 일 | 저장 |
|------|------|---------|------|
| 콘텐츠 가이드 | `content-guide` | 발행 주제·레퍼런스·감정톤·AI 스크립트·내 콘텐츠화 | Supabase + localStorage |
| 콘텐츠 분석기 | `content-analyzer` | URL → 감정·BGM·스토리·제작 가이드 (Gemini + W11) | localStorage |
| 제작 진행 보드 | `production-tracker` | 영상 6단계 진행·메모 | localStorage |
| 발행 편집·변환 | `content-studio` | 본문 편집·포맷 변환 | localStorage |
| 히스토리 관리 | `generation-history` | draft·polished 검색·재활용 | Supabase |

**콘텐츠 가이드 흐름:**

1. 카테고리·포맷 (blog / carousel / shortform / longform)
2. 발행 주제 입력 (필수)
3. (선택) 레퍼런스·감정 톤·숏폼 카테고리
4. 생성 — n8n W08 → 폴백 `content-generate`
5. 숏폼: `flowPasteBlock` (Google Flow용) + 씬별 붙여넣기
6. 내 콘텐츠화 → 히스토리 / 발행 편집

**콘텐츠 분석기:**

- YouTube: Gemini `fileUri`로 영상 직접 시청
- Instagram/TikTok: URL·메모 기반 추정 분석
- BGM: Gemini 추정 + (설정 시) n8n W11 AudD 정밀 매칭
- API: `POST /api/dashboard/content-analyzer` (`GEMINI_API_KEY` + `DASHBOARD_GEMINI_DIRECT=1` 필수)

### 4.3 채널 등록

| 화면 | view | 하는 일 |
|------|------|---------|
| 채널·콘텐츠 등록 | `benchmark` | 채널 검색·등록·벌크 import·카테고리·콘텐츠 스타일 |

### 4.4 콘텐츠 분석 (레퍼런스)

`PlatformView` 기반 — vs.Avg, Tier, 카테고리 필터

| 화면 | 플랫폼 | 수집 |
|------|--------|------|
| YouTube Shorts/롱폼 | youtube | ✅ |
| 네이버 블로그 | naver-blog | ✅ |
| 티스토리 | tistory | ✅ |

TikTok·Instagram **레퍼런스 수집 없음** — `publish-expand`에서 발행 가이드만 제공.

### 4.5 기획 / 인사이트

| 화면 | API·데이터 |
|------|-------------|
| 트렌딩 | `/api/dashboard/trending` |
| Outlier | `videos`, `outlier_tags`, W02 |
| AI 인사이트 | `/api/dashboard/insights`, n8n W10 |
| 주제 선별 AI | `/api/topic-suggest`, n8n W09 |

기획 큐: localStorage `planning-queue-v1` → 가이드 연동

### 4.6 내 채널 · 발행 확장

- **내 채널:** `is_mine` 채널만 필터 (`mineOnly`)
- **발행 확장:** TikTok·Instagram·Blogger 포맷·SEO·체크리스트 (실수집 없음)

### 4.7 파이프라인

| 화면 | DB |
|------|-----|
| Repurposing | `repurpose_items` |
| Deploy | `deploy_tasks` |
| 데이터 수집 | API + n8n W01~W07 |

### 4.8 수익 추적

로드맵·UI 중심 — 실데이터 RPM 연동 없음

---

## 5. 플랫폼·데이터 성숙도

| 표시 | 의미 |
|------|------|
| (없음) | 실데이터·수집 연동 |
| **(일부 더미)** | `content-guide`, `automation`, `n8n-lv1` |
| **발행** 배지 | TikTok·Instagram·Blogger — 가이드만 |

정의: `lib/dashboard/platforms.ts`, `dashboard-nav.ts`

---

## 6. 데이터 저장소

### Supabase

| 테이블 | 용도 |
|--------|------|
| `channels`, `videos` | 채널·콘텐츠·vs.Avg·format |
| `outlier_tags`, `rss_topic_candidates` | Outlier·RSS |
| `content_generation_history` | 생성 히스토리 |
| `topic_keyword_guide_history` | 주제 키워드 가이드 히스토리 |
| `calendar_items`, `repurpose_items`, `deploy_tasks` | 워크스페이스 |
| `dashboard_app_users` | 로그인 |

마이그레이션: `docs/migrations/` (`00`~`15`)

### localStorage (주요 키)

| 키 | 용도 |
|----|------|
| `guide-publish-topic-v1` | 발행 주제 |
| `dashboard_guide_references` | 가이드 레퍼런스 |
| `planning-queue-v1` | 기획 큐 |
| `content-analyzer-history` | 분석기 히스토리 |
| `production-tracker-v1` | 제작 진행 보드 |
| ContentStudioView 내부 | 발행 편집 본문 |

---

## 7. n8n ↔ 대시보드

| No | Webhook | 스케줄 | 연결 화면 |
|----|---------|--------|-----------|
| W01 | `youtube-collect` | 12h | data-collect |
| W02 | `outlier-tagging` | 12h | outlier |
| W03 | `rss-topic-collect` | 12h | content-guide |
| W04 | `naver-blog-collect` | 12h | naver-blog |
| W05 | `tistory-collect` | 12h | tistory |
| W06 | `notion-log` | 후속 | data-collect |
| W07 | `naver-blog-views` | 12h | naver-blog |
| W08 | `longform-script` | 수동 | content-guide |
| W09 | `topic-suggest` | 수동 | topic-suggest |
| W10 | `ai-insights` | 수동 | ai-insight |
| W11 | `bgm-identify` | 수동 | content-analyzer (**미연결**) |

기동: `docker compose -f docker-compose.n8n.yml --env-file .env.local up -d` + `./scripts/n8n-setup.sh`

---

## 8. 핵심 API

| 경로 | 용도 |
|------|------|
| `POST /api/dashboard/collect-all` | 전체 수집 |
| `POST /api/dashboard/script-guide` | 콘텐츠 가이드 생성 |
| `POST /api/dashboard/content-analyzer` | URL 레퍼런스 분석 |
| `POST /api/dashboard/content-generate` | Gemini 직접 생성 (폴백) |
| `GET/POST /api/dashboard/generation-history` | 히스토리 CRUD |
| `GET /api/dashboard/insights` | AI 인사이트 |
| `POST /api/topic-suggest` | 주제 선별 |

인증: `middleware.ts` + `lib/dashboard/api-auth.ts`

---

## 9. 코드 단일 진입점

| 목적 | 파일 |
|------|------|
| 네비·메타 | `lib/dashboard/dashboard-nav.ts` |
| 화면 스위치 | `components/dashboard/DashboardPageContent.tsx` |
| n8n | `lib/n8n/live-workflows.ts` |
| 콘텐츠 분석 | `lib/dashboard/content-analyzer.ts` |
| n8n AI | `lib/dashboard/n8n-ai.ts` |
| 가이드라인 | `guidelines/contents_guideline.md` |

---

*구현 변경 시 `dashboard-nav.ts` + 이 문서 + SUMMARY를 함께 갱신하세요.*
