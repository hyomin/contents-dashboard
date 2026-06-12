# 변경 이력

## 2026-06-12

### 문서 리뉴얼
- `SUMMARY.md`, `guides/DASHBOARD_OVERVIEW.md` 현행 소스 기준 전면 갱신 (2026-06-12)
- 날짜·히스토리 문서 정리 — 삭제: `PROJECT_REPORT_20260524`, `PRIORITY_ACTION_PLAN_20260612`, `CONTENT_CREATION_PIPELINE_RECOVERY`, `DASHBOARD_OVERVIEW_20260530`, 채널 목록 20260525 시리즈, `LONGFORM_CAROUSEL_PIPELINE_PLAN`
- 루트 기획 대화보내기 삭제: `dashboard.md`, `analys.md`
- `LONGFORM_CAROUSEL.md`, `guides/YOUTUBE_BENCHMARK_CHANNELS.md` 신규
- `n8n/README.md` W10·W11 반영, `migrations/README.md` 13~15 반영

### 콘텐츠 분석기 (미커밋 개선)
- YouTube URL 정규화 (`normalizeYoutubeUrlForGemini`) — Gemini MIME 오류 방지
- JSON 파싱 폴백 (`sanitizeGeminiJsonText`)

---

## 2026-06-11

### feat: 콘텐츠 분석기·제작 진행 보드·감정 톤
- `content-analyzer` — URL 레퍼런스 분석 (Gemini + W11 BGM 병렬)
- `production-tracker` — 영상 6단계 진행 보드 (localStorage)
- `emotion-tones` — 가이드 생성 감정 톤
- 롱폼·히스토리 UI 개선
- W11 BGM JSON·`n8n-setup.sh`·`invokeBgmIdentifyN8n` (운영 연결은 미완)

---

## 2026-06-09

### fix: 주제 선별 AI n8n V2 응답 형식 크래시

---

## 2026-06-07

### feat: 롱폼·캐러셀 파이프라인 확장
- 챕터 마커·타겟 포맷, 마이그레이션 14·15
- `CONTENT_CREATION_WORKFLOW.md`, A-Z 체크리스트 추가

---

## 2026-05-31

### 문서·저장소 정리
- Agent 스냅샷 → `archive/agent-snapshots/`
- `docs/SUMMARY.md` 통합 갱신

---

## 2026-05-20

### 아웃라이어·n8n
- `outlier_tags`, W02, `live-workflows.ts`
- `lib/` 모듈 분리: `n8n/`, `data/`, `dashboard/`

---

## 2026-05-19

### Supabase 단일화·보안
- Prisma 제거, `DASHBOARD_API_SECRET` middleware

---

## 2026-05-17

- `docs/` 통합, vs.Avg·Tier 파이프라인
