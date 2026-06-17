# 콘텐츠 생성 — 현황 & 단계별 가이드

> **갱신:** 2026-06-12  
> 목적: 콘텐츠를 만들 때 화면 순서와 현재 파이프라인의 보강 지점을 정리합니다.

---

## 1. 현재 제약·보강 필요 영역

| 영역 | 상태 | 영향 |
|------|------|------|
| TikTok·Instagram **레퍼런스 수집** | 발행 가이드만 | vs.Avg·Outlier는 YouTube Shorts 기준으로 기획 |
| n8n 인프라 | 로컬 Docker | PC 종료 시 스케줄·웹훅 중단 |
| 수익·시계열 차트 | UI·추정 | 성과 추이 정량 비교 어려움 |
| 자동화 테스트 | `verify:collect`만 | 회귀 수동 확인 |
| 마이그레이션 14·15 | 파일만 | 미적용 시 롱폼 vs.Avg 왜곡 가능 |

**한 줄:** 생성 파이프라인(가이드 → AI → 히스토리 → 제작)은 동작합니다. 부족한 쪽은 **멀티플랫폼 레퍼런스 데이터·운영 안정성**입니다.

숏폼 영상: **Google Flow (Veo)** — `guidelines/contents_guideline.md` 기준 (Higgsfield 아님).

---

## 2. 단계별 진행

### 0단계 — (선택) 소재 발굴

- `trending` · `outlier` · `ai-insight` · `topic-suggest`
- 기획 큐 `planning-queue-v1`에 저장 → 가이드에서 이어받기

### 0.5단계 — (선택) 레퍼런스 URL 분석

**콘텐츠 분석기** (`content-analyzer`)

- 마음에 드는 YouTube·Instagram·TikTok URL 입력
- 추구 감정·BGM(무드·식별·확보 가이드)·스토리·제작 가이드
- YouTube: Gemini 직접 시청·BGM 분석
- 필요: `GEMINI_API_KEY`, `DASHBOARD_GEMINI_DIRECT=1`

### 1단계 — 콘텐츠 가이드 (`content-guide`)

1. 카테고리·포맷 — blog / carousel / shortform / longform
2. (선택) 주제 키워드 가이드
3. **(필수) 발행 주제** 입력
4. (선택) 레퍼런스·**감정 톤**·숏폼 카테고리
5. AI 모델 선택 — Flash / Pro
6. 생성 — n8n W08 → 폴백 `content-generate`
7. 숏폼: `flowPasteBlock` (Google Flow) + 씬별 붙여넣기

`mode: ai-enhanced` = 정상, `fallback` = n8n·Gemini 점검

### 1.5단계 — (영상) 제작 진행 보드 (`production-tracker`)

기획·대본 → 비주얼 → 나레이션 → BGM → 편집 → 자막 — 6단계 진행·메모 (localStorage)

### 2단계 — 정제 (Polish)

`guidelines/contents_guideline.md` 형식 자동 반영. 파일만 편집하면 즉시 반영 (재시작 불필요).

### 3단계 — 히스토리 (`generation-history`)

Supabase `content_generation_history` — draft + polished 자동 저장

### 4단계 — 발행 편집·변환 (`content-studio`)

최종 다듬기·포맷 변환 — localStorage (원본은 히스토리에 보관)

### 5단계 — 발행 확장 (`publish-expand`)

TikTok · Instagram Reels/캐러셀 · Google Blogger — **가이드만** (자동 업로드 없음)

### 6단계 — 일정·배포

`calendar` · `deploy` (로컬 n8n 의존)

### 7단계 — 성과·재가공

`outlier` → `repurpose`

---

## 3. 한눈에 보는 흐름

```
0. 소재 발굴     trending · outlier · ai-insight · topic-suggest
0.5 (선택)      content-analyzer  (URL 레퍼런스 분석)
1. 초안 생성     content-guide
1.5 (영상)      production-tracker
2. 정제          guidelines 자동 반영
3. 히스토리      generation-history
4. 편집·변환     content-studio
5. 발행 확장     publish-expand
6. 일정·배포     calendar / deploy
7. 성과·재가공   outlier → repurpose
```

---

## 관련 문서

- [SUMMARY.md](../SUMMARY.md)
- [CONTENT_PRODUCTION_AZ_CHECKLIST.md](./CONTENT_PRODUCTION_AZ_CHECKLIST.md)
- [DASHBOARD_USAGE.md](./DASHBOARD_USAGE.md)
- [guidelines/contents_guideline.md](../../guidelines/contents_guideline.md)
