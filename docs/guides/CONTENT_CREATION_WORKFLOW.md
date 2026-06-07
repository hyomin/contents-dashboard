# 콘텐츠 생성 — 현황 점검 & 단계별 진행 가이드

> 작성일: 2026-06-07
> 목적: Gemini 결제 연결 이후, 콘텐츠를 만들 때 어떤 순서로 화면을 거치면 되는지 정리하고
> 현재 파이프라인에서 보강이 필요한 지점을 짚어둔다.

---

## 1. 지금 부족한 점 (검토 결과)

| 영역 | 현재 상태 | 영향 |
|------|-----------|------|
| **TikTok 레퍼런스 수집** | UI + 더미 데이터만 존재 | TikTok용 vs.Avg·아웃라이어 분석 불가 — 현재는 YouTube Shorts 기준으로만 기획해야 함 |
| **Instagram 레퍼런스 수집** | "준비 중" shell | Reels·캐러셀 레퍼런스 분석 불가 — 발행 확장(`publish-expand`)은 가이드만 제공, 실데이터 비교는 없음 |
| **수익 추적** | 로드맵·UI 중심, 실제 데이터 연동 없음 | 콘텐츠별 수익 기여도를 정량적으로 비교하기 어려움 |
| **기간별 추이 차트** | 없음 | "이 주제가 시간이 지나며 어떻게 성장했는지" 추세 파악 불가 — 현재는 스냅샷(현재 시점) 비교만 가능 |
| **n8n·자동화 인프라** | 로컬 Docker 의존 | **PC를 끄면 예약 수집·콘텐츠 자동 생성이 모두 멈춤** — 운영 안정성의 가장 큰 약점 |
| **자동화 테스트** | `verify:collect` 스크립트만 존재, Vitest/Playwright 없음 | 리팩토링·기능 추가 시 회귀(regression) 위험을 사람이 직접 확인해야 함 |
| **AI 모델 가용성 변화 대응** | 코드에 모델 ID(`gemini-2.5-flash`/`gemini-2.5-pro`)가 고정 | Google이 모델을 deprecate하면(예: `gemini-2.0-flash` 사례) 알림 없이 호출이 막힐 수 있음 — 주기적 점검 필요 |

> 참고: `automation`·`content-guide`·`n8n-lv1` 화면은 사이드바에 **(일부 더미)** 배지가 붙어 있다 (`lib/dashboard/dashboard-nav.ts`의 `NAV_PARTIAL_DUMMY_VIEW_IDS`).

**한 줄 요약:** 콘텐츠 *생성* 파이프라인 자체(가이드 → AI 생성 → 히스토리 → 제작 → 발행 확장)는 이미 탄탄하게 갖춰져 있다. 부족한 부분은 대부분 **"생성 이후/생성 이전"** — 즉 ① 멀티플랫폼 레퍼런스 데이터, ② 운영 안정성(클라우드 이전), ③ 성과 추적(추이·수익) 쪽이다.

---

## 2. 콘텐츠 생성 — 단계별 진행 가이드

### 0단계 — (선택) 소재 발굴: 인사이트·기획
콘텐츠 주제가 아직 없다면 먼저 소재를 찾는다.

- **트렌딩** (`trending`) — 현재 떠오르는 키워드·포맷 확인
- **Outlier 분석** (`outlier`) — 평균 대비 튀는 콘텐츠(vs.Avg) 확인 → 태깅
- **AI 인사이트** (`ai-insight`) — Gemini + Google Search Grounding 기반 트렌드 요약
- **주제 선별 AI** (`topic-suggest`) — 레퍼런스 분석 기반으로 AI가 발행 주제를 추천
- 마음에 드는 소재는 **기획 큐**(`planning-queue-v1`)에 저장해두면 가이드 화면에서 바로 이어받을 수 있다

> 이미 발행하고 싶은 주제가 정해져 있다면 이 단계는 건너뛰고 1단계로.

---

### 1단계 — 콘텐츠 가이드에서 초안 생성 (`content-guide`)
실제 생성은 이 화면에서 시작한다. 화면에 표시된 순서 그대로 진행하면 된다.

1. **카테고리·포맷 선택** — 글쓰기(blog) / 이미지(carousel) / 영상(shortform·longform) 중 선택
2. **(선택·1단계) 주제 키워드 가이드** — 아직 주제가 안 정해졌다면, AI가 제안하는 주제 카드 중 하나를 클릭해 자동 입력
3. **(필수·2단계) 발행 주제 입력** — 핵심 키워드를 직접 입력 (AI가 최우선으로 반영하는 항목)
4. **(선택·3단계) 참고 레퍼런스 추가** — YouTube·블로그·웹 페이지를 레퍼런스로 추가. "구조·톤만 참고" / "내용까지 반영" 모드를 레퍼런스마다 다르게 설정 가능
5. **AI 모델 선택** — 기본값 `Gemini 2.5 Flash`(빠름·균형) 또는 `Gemini 2.5 Pro`(고품질·느림)
6. **생성 실행** — n8n `longform-script` 워크플로 우선 호출 → 실패 시 `/api/dashboard/content-generate`(직접 Gemini 호출)로 자동 폴백
   - 응답의 `mode` 값으로 AI가 실제로 호출됐는지 확인할 수 있다: `ai-enhanced`(AI 적용) vs `fallback`(템플릿)

> 💡 결제 연결 후에는 `mode: ai-enhanced`가 정상적으로 떠야 한다. 계속 `fallback`이 보이면 n8n 워크플로 또는 Gemini 키 상태를 점검한다.

---

### 2단계 — 정제(Polish) — 가이드라인 반영
생성된 초안에 `guidelines/contents_guideline.md`에 정의된 형식(목차, 구조, 톤, 이미지 가이드 수 등)을 자동 반영해 발행용 본문으로 다듬는다. 가이드라인 자체를 수정하고 싶다면 `guidelines/contents_guideline.md`를 편집·저장하기만 하면 되고, 서버 재시작은 필요 없다.

---

### 3단계 — 히스토리에 자동 저장 (`generation-history`)
생성·정제된 결과(draft + polished)는 Supabase `content_generation_history`에 자동으로 쌓인다. 나중에 다시 찾아보거나 다른 포맷으로 재활용할 때 이 화면에서 불러온다.

---

### 4단계 — 발행 편집·포맷 변환 (`content-studio`)
- 콘텐츠 가이드에서 만든 **발행용 본문을 불러와** 최종 문장 다듬기, 촬영 메모 추가, `.txt`로 내보내기 등을 수행
- **다른 포맷으로 변환**도 이 화면에서: 예) 블로그 글 → 숏폼 스크립트
- 처음부터 새로 생성하는 건 1단계(콘텐츠 가이드)에서, 이미 있는 결과의 **마감·변환**은 여기서 — 라는 역할 분리를 기억해두면 헷갈리지 않는다
- 단, 이 화면의 편집 내용은 **브라우저 localStorage**에만 저장된다 (발행용 원본은 히스토리·Supabase에 별도 보관)

---

### 5단계 — (TikTok·Instagram·Blogger로 미러 발행 시) 발행 확장 (`publish-expand`)
YouTube Shorts·블로그용으로 만든 완성본을 다른 채널에도 올리고 싶다면 이 패널을 연다.

- **TikTok** — Shorts 완성본 변환·발행 가이드 (레퍼런스 분석·vs.Avg는 아직 YouTube Shorts 기준)
- **Instagram (Reels·캐러셀)** — 포맷·캡션·안전 영역·슬라이드 설계 가이드
- **Google Blogger** — 네이버 블로그 본문을 Google SEO·AdSense에 맞게 미러 발행하는 체크리스트 (`guidelines/contents_guideline.md`의 "Google Blogger (발행 확장)" 섹션 참고)

> 이 화면은 "발행 가이드"이지, 자동 업로드가 아니다. 실제 업로드는 각 플랫폼에서 수동으로 진행한다.

---

### 6단계 — 일정 등록·배포 (`calendar` / `deploy`)
- **캘린더** — 발행 일정 등록·관리
- **배포 자동화** — n8n 기반 멀티채널 배포 (현재 로컬 n8n 의존 — PC가 켜져 있어야 동작)

---

### 7단계 — 발행 후 — 성과 추적·재가공 (`outlier` / `repurpose`)
- 발행한 콘텐츠가 시간이 지나며 vs.Avg·조회수가 어떻게 변하는지 **Outlier 분석**에서 확인
- 반응이 좋은 콘텐츠는 **Repurposing**(`repurpose`)에서 다른 포맷·플랫폼으로 재가공해 한 번 더 활용

---

## 3. 한눈에 보는 흐름

```
0. 소재 발굴            trending · outlier · ai-insight · topic-suggest
        ↓
1. 초안 생성            content-guide  (주제 가이드 → 발행 주제 → 레퍼런스 → AI 생성)
        ↓
2. 정제                 (가이드라인 자동 반영 — guidelines/contents_guideline.md)
        ↓
3. 히스토리 저장        generation-history  (Supabase 자동 보관)
        ↓
4. 편집·포맷 변환       content-studio  (마감 다듬기 · 다른 포맷으로 변환)
        ↓
5. (선택) 발행 확장     publish-expand  (TikTok·Instagram·Blogger 미러 가이드)
        ↓
6. 일정·배포            calendar / deploy
        ↓
7. 성과 추적·재가공     outlier(추이 확인) → repurpose(재가공)
```

---

## 관련 문서
- [SUMMARY.md](../SUMMARY.md) — 전체 현황 요약
- [CONTENT_CREATION_PIPELINE_RECOVERY.md](./CONTENT_CREATION_PIPELINE_RECOVERY.md) — 파이프라인 복구 이력
- [DASHBOARD_USAGE.md](./DASHBOARD_USAGE.md) — n8n·대시보드 사용 타이밍
- [`guidelines/contents_guideline.md`](../../guidelines/contents_guideline.md) — Agent 프롬프트·발행 형식 원본 (직접 수정 가능)
