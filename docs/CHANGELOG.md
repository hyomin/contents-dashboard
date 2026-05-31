# 변경 이력

## 2026-05-31

### 문서·저장소 정리
- 루트 `20260*` 스냅샷 14개 → `archive/agent-snapshots/` 이동
- `.gitignore`: `/archive/` 추가 (루트 14자리 패턴 유지)
- `docs/SUMMARY.md` — 2026-05-30 OVERVIEW 기준으로 통합 갱신 (진입 문서)
- `docs/README.md`, `PROGRESS.md`, OVERVIEW 상단 링크 정리

---

## 2026-05-20

### 문서·구조 정리
- `docs/` 재구성: `migrations/`, `guides/`, `n8n/workflows/`
- `SUMMARY.md` (현황 요약), `CHANGELOG.md` 추가 — `PROGRESS.md` 대체
- `lib/` 모듈 분리: `n8n/`, `data/`, `dashboard/` + 루트 re-export

### 아웃라이어 자동 태깅
- `outlier_tags` 테이블, `04-outlier-tags.sql`
- `N8N_OUTLIER_TAGGING.json`, Webhook `outlier-tagging`
- `POST /api/dashboard/outlier-tag`, Outlier UI 태깅 버튼

### n8n·워크플로 UI
- 의미 없는 n8n 워크플로 삭제 (구버전 YouTube 중복, 주제 선별 AI)
- `lib/n8n/live-workflows.ts` — 현행 2개 워크플로 기준
- Webhook «구현됨» = n8n 실제 등록만

### 기타
- Soft 테마, «내 채널» 네비, 채널 등록 모달 overflow 수정
- `n8n-setup.sh` 워크플로 이름 공백 버그 수정

---

## 2026-05-19

### Supabase 단일화
- Prisma/pg 제거
- 워크스페이스 Supabase 이전 (`01-workspace.sql`)
- Instagram 자동 수집 없음 — «준비 중»

### P0 — 빌드·보안
- `useSearchParams` Suspense 분리
- `DASHBOARD_API_SECRET` middleware

### P1 — 실데이터·수집
- 트렌딩/AI 인사이트/Overview → `/api/dashboard/insights`
- YouTube n8n JSON env 변수화, Webhook `youtube-collect`
- 데이터 수집 화면 실 API 연동

---

## 2026-05-17

- 분산 SQL/MD → `docs/` 통합
- Supabase `channels`, `videos`, vs.Avg·Tier 파이프라인
