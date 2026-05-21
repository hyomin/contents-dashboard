# Contents Dashboard — 진행 사항 요약

**최종 갱신:** 2026-05-20 (전개 로드맵·총평 추가)

## 프로젝트 개요

AI·데이터 기반 **멀티플랫폼 콘텐츠 대시보드** (Next.js 16 App Router + Supabase + n8n).  
YouTube 채널·영상을 수집하고 **vs.Avg**(채널 평균 대비 조회 배율)로 아웃라이어를 찾는 것이 핵심입니다.

| 구분 | 기술 |
|------|------|
| Frontend | Next.js, React, TypeScript, Tailwind |
| DB | Supabase (PostgreSQL) only |
| 자동화 | n8n (Docker, localhost:5678) |
| API | YouTube Data API v3 |

---

## 완료된 주요 기능

### 대시보드 UI·네비

- **«내 채널»** 중심 네비: 운영 허브, 캘린더, 플랫폼별 통계
- **Soft 테마** (light → soft → dark → system)
- Overview / Outlier / Platform / 벤치마크 / 수익 / 워크플로 관리 등 한글 UI

### 데이터·수집

- Supabase `channels`, `videos` — vs.Avg, S/A/B/C Tier
- 대시보드 API: `collect`, `collect-all`, `collect-platform` (mineOnly 등)
- 영상 **format** (short/long), `saved_shorts`
- 채널 **주제 카테고리** (`channel_categories`)
- 워크스페이스: `channel_flags`, `calendar_items`, `repurpose_items`, `deploy_tasks` (localStorage 제거, Supabase 단일화)

### n8n 연동 (현행 2개)

| 워크플로 | Webhook | 트리거 | 역할 |
|----------|---------|--------|------|
| YouTube 채널 데이터 수집 | `youtube-collect` | Webhook·수동·6h 스케줄 | 채널 목록 → YouTube API → Supabase |
| 아웃라이어 자동 태깅 | `outlier-tagging` | Webhook·수동·12h 스케줄 | vs.Avg≥3 → `outlier_tags` 저장 |

- **워크플로 관리** 화면: n8n Webhook 프로브, «현재 n8n 연동» 패널, 로드맵별 구현 상태
- **구현됨** = Docker n8n에 Webhook 실제 등록(404 아님)만 표시
- `./scripts/n8n-setup.sh` — 임포트·활성화·프로브

### 아웃라이어

- `outlier_tags` 테이블 + `POST /api/dashboard/outlier-tag` (태깅 + Tier 상향)
- Outlier 화면: `▶ 3x+ 자동 태깅`, «태깅만 보기»
- n8n 미연결 시 대시보드 API 폴백

### 보안·품질

- 프로덕션 API: `DASHBOARD_API_SECRET` + middleware
- `/dashboard` Suspense 분리
- `npm run verify:collect` 수집 파이프라인 검증

---

## Supabase 마이그레이션

`docs/migrations/` — [README](./migrations/README.md)

| 파일 | 용도 |
|------|------|
| `00-schema-full.sql` | 전체 스키마 |
| `01-workspace.sql` | 플래그·캘린더·리퍼포즈·배포 |
| `02-channel-categories.sql` | 채널 카테고리 |
| `03-video-format.sql` | Shorts/롱폼·saved_shorts |
| `04-outlier-tags.sql` | 아웃라이어 태깅 |

**아웃라이어 태깅 사용 전** `04-outlier-tags.sql` 실행 필수.

---

## 코드 구조 (리팩토링 후)

```
lib/
├── n8n/           # live-workflows, research-roadmap, urls, deploy-status …
├── data/          # supabase, queries, outlier-tagging, youtube-collect …
├── dashboard/     # nav, types, helpers, storage, platforms …
└── *.ts           # 하위 호환 re-export (점진적 @/lib/n8n/… 로 이전)
```

---

## 환경변수 (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
YOUTUBE_API_KEY=…
N8N_WEBHOOK_YOUTUBE_COLLECT=http://localhost:5678/webhook/youtube-collect
N8N_WEBHOOK_OUTLIER_TAG=http://localhost:5678/webhook/outlier-tagging
# DASHBOARD_API_SECRET=…  (프로덕션)
```

---

## 로컬 접속

| 용도 | URL |
|------|-----|
| 대시보드 | http://localhost:3000/dashboard |
| n8n 직접 | http://localhost:5678 |
| n8n 경유 | http://localhost:3000/n8n (끝 `/` 금지) |

---

## 앞으로의 전개 로드맵 (합의안)

아래 6단계는 **프로젝트 최종 그림**으로 타당합니다.  
다만 **순서는 1→2를 유지한 뒤, 3(멀티플랫폼 수집)을 4~6(AI·생성)보다 먼저** 두는 것이 안전합니다. (데이터 없이 AI만 키우면 빈 화면이 늘어남)

| 단계 | 목표 | 현재 기반 | 비고 |
|------|------|-----------|------|
| **1** | n8n 기능 확장 구현 | YouTube 수집·아웃라이어 태깅 2개 | RSS, Apify, 주간 리포트 등 `research-roadmap` Lv.1~2 |
| **2** | 대시보드 각 영역 서비스 연동 | 워크플로 관리·Outlier·수집 화면 | «구현됨 = Webhook» 기준, 뷰별 `N8nLv1ServicesSection` |
| **3** | 인스타·틱톡·네이버·티스토리 채널 등록·분석 | `channels.platform`, Platform 뷰 껍데기 | IG «준비 중», TikTok 더미 — **수집 API·스키마 통일**이 핵심 |
| **4** | AI Agent 주제 선정·작성 템플릿 가이드 | `topic-suggest`, `content-guide`, JSON 보관 | n8n LangChain + Outlier/트렌드 **입력 데이터** 필요 |
| **5** | 주제 맞춤 AI 콘텐츠 생성 | `content-studio`, 롱폼 더미 | 4번 주제·페르소나·레퍼런스가 선행 |
| **6** | 롱/숏/캐러셀/블로그 화 정리 자동화 | `repurpose`, `deploy`, `format` | 5번 산출물 → n8n 멀티 발행 파이프라인 |

### 권장 묶음 (실행 단위)

```
[Phase A · 분석 강화]  1 + 2  → n8n 하나 붙일 때마다 해당 대시보드 뷰까지 같이
[Phase B · 멀티플랫폼]  3      → 플랫폼당 «등록 → 수집 → vs.Avg(또는 동등 지표)» 최소 루프
[Phase C · 기획 AI]    4      → 주제선별 Agent + 가이드 템플릿 (YouTube·B만 먼저)
[Phase D · 제작·배포]  5 → 6  → 생성 → 포맷 분기 → 캘린더/배포 연동
```

### 기존 n8n 로드맵과의 대응

- 1~2단계 ≈ Lv.1 `next` 항목 (아웃라이어 태깅 ✅, RSS·롱폼 등)
- 3단계 ≈ Lv.2 Apify·멀티 플랫폼 + 채널 등록 UI 확장
- 4~6단계 ≈ Lv.1 dummy + Lv.3 Agent·멀티유즈 파이프라인

상세 24항목: `docs/guides/n8n-research.html`, `lib/n8n/research-roadmap.ts`

---

## 객관적 총평 (2026-05-20)

### 한 줄

**YouTube 벤치마킹·아웃라이어 발굴용 내부 분석 도구로는 이미 쓸 만하고**, 멀티플랫폼·AI 기획·발행 허브로는 위 6단계 로드맵이 맞는 방향이다.

### 점수 (10점 만점)

| 관점 | 점수 | 요약 |
|------|------|------|
| 핵심 분석 MVP (YouTube·vs.Avg·Outlier) | 7~8 | 수집→저장→필터→태깅 연결 |
| 로드맵 대비 자동화 구현률 (~24항목) | ~15% | n8n Webhook 2개 + 일부 API |
| 멀티플랫폼·AI 분석 완성도 | 3~4 | 3~6단계 대부분 미래 |
| 운영·확장 기반 (DB·문서·모듈) | 7 | Supabase 단일화·docs 정리 완료 |

### 지금 답할 수 있는 질문

- 경쟁·내 채널 중 **평균 대비 잘 된 영상**은 무엇인가?
- **3x+ 아웃라이어**를 모아 기획·Repurpose 후보로 쓸 수 있는가?
- Shorts/롱폼·카테고리별로 **필터링**할 수 있는가?

### 아직 약한 부분

- CTR·시청 지속·댓글 등 **깊은 지표**, 기간별 **추이 차트**
- Instagram 등 **실수집·실분석** (UI만 있는 상태)
- AI **「왜 터졌는지」** 패턴 분석 (4단계 이후)
- 실수익·Studio Analytics 연동

### 결론

«미구현이 많다»는 인상과 «분석할 역량은 된다»는 판단 **둘 다 맞다**.  
위 **6단계 전개**는 과하지 않으며, **3을 4보다 앞에** 두면 리스크가 가장 적다.

---

## 관련 문서

- [CHANGELOG.md](./CHANGELOG.md) — 날짜별 이력
- [guides/DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md) — 대시보드·n8n 사용법
