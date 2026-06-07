# 롱폼 · 캐러셀 파이프라인 확장 액션플랜

> 작성 기준일: 2026-06-07  
> 대상 프로젝트: `dashboard-app/`  
> 목표: 숏폼과 동등한 수준의 **롱폼(YouTube 8~12분)** 및 **캐러셀(Instagram 슬라이드)** 생성·수집·분석 파이프라인 구축

---

## 1. 현황 진단 — 솔직한 평가

### 숏폼 파이프라인 (기준선)

```
아웃라이어 탐지 → 레퍼런스 선택 → script-guide API
  → n8n W08(Gemini) → flowPasteBlock(Higgsfield용) + fullContent
  → content-polish → Supabase 저장 → 히스토리/콘텐츠 제작 뷰
```

**완성 상태.** 데이터 수집(cron) → 생성 → 저장 → 재사용이 모두 연결돼 있음.

---

### 롱폼 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| 타입 정의 (`intent: 'longform_video'`) | ✅ 존재 | `content-creation-guide.ts` |
| n8n 페이로드 (`durationMinutes: 8`) | ✅ 존재 | `n8n-ai.ts` |
| n8n W08 워크플로 롱폼 분기 | ⚠️ 숏폼과 공유 | 별도 프롬프트 없음 |
| DB 수집 (`videos.format = 'long'`) | ✅ 이미 수집 | auto-collect cron 동작 중 |
| UI 롱폼 선택 토글 | ❌ 없음 | category=video 기본이 숏폼 |
| 챕터 구조 생성 (타임스탬프·목차) | ❌ 없음 | |
| 롱폼 전용 vs_avg 기준선 | ❌ 없음 | 숏폼과 같은 avg_views 풀로 계산됨 |
| YouTube 챕터 마커 자동 생성 | ❌ 없음 | |

### 캐러셀 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| 타입 정의 (`intent: 'carousel'`) | ✅ 존재 | |
| CAROUSEL_RULES 프롬프트 블록 | ✅ 존재 | `direct-publish-generate.ts` |
| `content-generate` carousel 처리 | ✅ 존재 | API 레벨에서 분기 |
| n8n 캐러셀 전용 워크플로 | ❌ 없음 | |
| Instagram 캐러셀 수집 (저장·도달) | ❌ 없음 | `videos` 테이블이 YouTube 중심 |
| 슬라이드별 이미지 생성 파이프라인 | ❌ 없음 | |
| 캐러셀 전용 벤치마크 기준 | ❌ 없음 | |

### 결론

롱폼은 **인프라(DB·타입·n8n 진입점)는 있고 UI·프롬프트·분석이 없는** 상태.  
캐러셀은 **타입과 프롬프트 규칙만 있고 수집·생성·분석 파이프라인 전부 없는** 상태.

---

## 2. 롱폼 파이프라인 액션플랜

### Phase L-1. 데이터 기반 정비 (선행 조건)

**목적:** 롱폼 vs_avg가 숏폼과 섞이면 기준선이 왜곡됨. 분리 먼저.

**작업 L-1-1. DB 마이그레이션**

```sql
-- migrations/14-longform-metrics.sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS avg_views_longform INTEGER DEFAULT 0;
-- 채널 내 롱폼(duration > 180초)만의 평균 조회수 별도 저장
-- vs_avg는 기존 유지 (채널 전체 평균), vs_avg_longform 추가
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vs_avg_longform DECIMAL DEFAULT 0;

-- 챕터 마커 저장용 (생성 결과 재사용)
ALTER TABLE content_generation_history
  ADD COLUMN IF NOT EXISTS target_format TEXT DEFAULT 'shortform',
  ADD COLUMN IF NOT EXISTS chapter_markers JSONB;
-- chapter_markers: [{ "timestamp": "0:00", "title": "오프닝" }, ...]
```

**작업 L-1-2. n8n 아웃라이어 태깅 워크플로 수정**

현재 `N8N_OUTLIER_TAGGING.json`이 `format` 구분 없이 전체 vs_avg를 계산함.  
롱폼(`duration > 180`) 채널의 `avg_views`를 별도 집계해 `vs_avg_longform` 업데이트하는 분기 추가.

---

### Phase L-2. 생성 파이프라인 분리

**작업 L-2-1. n8n 롱폼 전용 워크플로 (N8N_LONGFORM_DEDICATED.json)**

현재 W08은 숏폼·롱폼 공용. 롱폼 전용 워크플로를 별도로 만드는 이유:
- 프롬프트 토큰 사용량이 3~4배 많음 (챕터 8개 × 3분 분량)
- 실패 시 롤백 전략이 다름 (숏폼은 60초, 롱폼은 8분 초안이 없으면 의미 없음)
- Gemini 타임아웃 설정 분리 필요 (숏폼 30초, 롱폼 120초)

```
[Webhook] → [파라미터 파싱] → [롱폼 프롬프트 준비]
  → [Gemini: 8~12분 챕터 구조 생성]
  → [챕터 마커 추출] → [YouTube 설명란 포맷 변환]
  → [응답 반환]
```

**롱폼 전용 프롬프트 포인트:**

```
- 오프닝 훅(0~30초): 결론 미리보기 or 수치 공개
- 챕터 6~8개: 각 챕터 제목 + 3~4분 분량 핵심 불릿 3개
- 챕터별 타임스탬프 (00:00 형식)
- 엔딩(마지막 1분): 구독 CTA + 다음 영상 예고
- YouTube 설명란 붙여넣기용 챕터 블록 별도 출력
```

**작업 L-2-2. script-guide API 롱폼 라우팅 추가**

`lib/dashboard/n8n-ai.ts`에 `invokeLongformDedicatedN8n()` 함수 추가.  
`script-guide/route.ts`에서 `intent === 'longform_video'` 시 전용 웹훅 우선 호출.

```ts
// n8n-ai.ts 추가
export function getLongformDedicatedWebhookUrl(): string {
  return resolveN8nWebhookUrl('N8N_WEBHOOK_LONGFORM_DEDICATED', 'longform-dedicated')
}
```

**작업 L-2-3. UI 롱폼 선택 토글**

현재 `category=video`는 숏폼이 기본값. `intent` 선택 UI 추가 필요.

- 콘텐츠 가이드 뷰에 **숏폼 / 롱폼** 탭 추가 (현재 없음)
- 롱폼 선택 시 레퍼런스 목록도 `videos.format = 'long'` 필터로 전환
- 생성 결과 카드에 챕터 목록 + 유튜브 설명란 복사 버튼 표시

---

### Phase L-3. 성과 추적

**작업 L-3-1. 롱폼 전용 대시보드 지표**

숏폼과 다른 지표가 필요:

| 숏폼 | 롱폼 |
|------|------|
| vs_avg (조회수 배율) | vs_avg_longform |
| 초기 재생률 | 평균 시청 시간 % (YouTube Studio API) |
| 루프율 | 클릭률(CTR) by 썸네일 |
| 저장수 | 구독자 전환율 |

YouTube Data API v3의 `videos.statistics`만으로는 시청 시간 데이터를 얻을 수 없음.  
→ YouTube Analytics API(`reports.query`) 별도 연동 필요. n8n HTTP Request 노드로 추가 가능.

**작업 L-3-2. 롱폼 벤치마크 카테고리 추가**

현재 `benchmark_categories` 테이블에 숏폼 기준만 있을 가능성 높음.  
`type: 'longform'` 카테고리 추가 후 채널별 롱폼 vs_avg 기준 분리.

---

## 3. 캐러셀 파이프라인 액션플랜

### Phase C-1. 데이터 수집 기반

**작업 C-1-1. Instagram 캐러셀 수집**

현재 `videos` 테이블은 YouTube 중심. Instagram API(Meta Graph API)로 캐러셀 포스트를 수집하려면:

- `media_type = 'CAROUSEL_ALBUM'` 필터
- 수집 지표: `like_count`, `comments_count`, `saved` (Insights API 필요), `reach`
- `videos.platform = 'instagram'`, `format = 'carousel'`로 저장

> **현실적 제약:** Instagram Basic Display API는 saved/reach를 주지 않음.  
> Insights API는 Business 계정 + 앱 승인 필요. 계정이 Creator/Business인지 먼저 확인.

**작업 C-1-2. 캐러셀 전용 vs_avg 정의**

Instagram 캐러셀의 "아웃라이어" 기준을 정의해야 함:

```
캐러셀 vs_avg = 해당 포스트 저장수 / 채널 평균 저장수
(저장수를 쓰는 이유: 캐러셀은 조회수보다 저장이 바이럴 지표에 더 가까움)
```

대안: Instagram Insights 접근이 막히면 수동 입력 + DB 저장 방식으로 시작 후 API 연동.

---

### Phase C-2. 생성 파이프라인

**작업 C-2-1. n8n 캐러셀 전용 워크플로 (N8N_CAROUSEL_GENERATE.json)**

```
[Webhook] → [파라미터 파싱] → [캐러셀 프롬프트 준비]
  → [Gemini: 슬라이드 구조 생성]
  → [슬라이드별 텍스트 파싱]
  → [(선택) 이미지 생성 API 호출]
  → [응답 반환]
```

**캐러셀 프롬프트 포인트 (CAROUSEL_RULES 확장):**

```
- 슬라이드 수: 7~10장 (저장율 최적)
- 1장(표지): 제목 + 저장 유도 문구
- 2~8장: 각 1개 팁/데이터/단계 (텍스트 40자 이내)
- 마지막장: CTA + 해시태그 5개
- 각 슬라이드에 배경 이미지 키워드(영문) 제시
- 전체 톤: [정보형 / 감성형 / 체크리스트형] 중 선택
```

**작업 C-2-2. UI 캐러셀 생성 흐름**

- 콘텐츠 가이드 `category=image` → `intent=carousel` 기본값 (현재 이미 image→carousel 매핑 있음)
- 생성 결과: 슬라이드별 텍스트 리스트 + 각 슬라이드 배경 이미지 키워드
- **Canva 연동 (선택):** Canva Connect API로 슬라이드 텍스트 자동 주입

**작업 C-2-3. 이미지 생성 연동 옵션**

| 옵션 | 방법 | 비용 | 자동화 수준 |
|------|------|------|------------|
| Canva API | n8n HTTP Request | 무료 플랜 있음 | 반자동 (텍스트 주입) |
| Midjourney | Discord API (비공식) | $10/월~ | 수동에 가까움 |
| Gemini Imagen | Vertex AI API | 사용량 과금 | 완전 자동 |
| Ideogram | REST API | 사용량 과금 | 완전 자동 |

**추천:** 초기에는 슬라이드 텍스트 + 배경 키워드만 생성 → Canva 수동 적용.  
자동화는 Gemini Imagen API(Vertex AI) 연동이 현 Gemini 스택과 일관성 높음.

---

### Phase C-3. 성과 추적

**작업 C-3-1. 캐러셀 성과 DB 컬럼 추가**

```sql
-- migrations/14-longform-metrics.sql (이어서)
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS saved_count INTEGER DEFAULT 0,   -- Instagram 저장수
  ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0,         -- 도달수
  ADD COLUMN IF NOT EXISTS slide_count INTEGER DEFAULT 0;   -- 슬라이드 수
```

**작업 C-3-2. 캐러셀 아웃라이어 기준**

```
tier 기준 (캐러셀):
  S: vs_avg(저장) ≥ 3.0
  A: vs_avg(저장) ≥ 1.8
  B: vs_avg(저장) ≥ 1.0
  C: vs_avg(저장) < 1.0
```

---

## 4. Higgsfield 연동 액션플랜

### 현재 상태

숏폼 스크립트 생성 시 `flowPasteBlock`에 영문 Higgsfield 프롬프트가 이미 생성됨.  
현재는 **수동 복붙** 방식. n8n에서 API 호출로 자동화 가능한지가 관건.

### Higgsfield API 현실

2026년 기준 Higgsfield AI는 웹 UI 기반이며 공개 REST API가 **베타 제한** 상태.  
- 공식 API 문서 없음 (대기자 신청 필요)
- 대안: Higgsfield 웹 UI의 네트워크 요청을 분석해 n8n HTTP Request로 래핑 (비공식, 서비스 변경 시 깨질 수 있음)

### 실용적 연동 방안

**단기 (지금 바로 가능):**  
`flowPasteBlock` 출력에 "Higgsfield 복사" 버튼 추가 → 클립보드에 복사 → 수동 붙여넣기  
(현재 UI에서 이 버튼이 명시적으로 없을 수 있음 — 확인 후 추가)

**중기 (API 공개 시):**

```
n8n 워크플로:
  [Gemini 스크립트 생성] → [flowPasteBlock 파싱]
  → [Higgsfield API POST /generate]
  → [영상 URL 반환] → [Supabase 저장]
```

**대안 (Higgsfield API 불가 시):**  
Runway ML Gen-3, Kling AI, Pika Labs는 API 제공 중.  
`flowPasteBlock` 프롬프트 포맷을 이 서비스들에 맞게 변환하는 어댑터를 n8n 코드 노드로 작성하면 교체 가능.

---

## 5. 공통 인프라 작업

### DB 마이그레이션 통합 (migrations/14-longform-carousel-metrics.sql)

```sql
-- 롱폼 지표
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vs_avg_longform DECIMAL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS avg_views_longform INTEGER DEFAULT 0;

-- 캐러셀 지표
ALTER TABLE videos ADD COLUMN IF NOT EXISTS saved_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS slide_count INTEGER DEFAULT 0;

-- 생성 히스토리 포맷 추적
ALTER TABLE content_generation_history
  ADD COLUMN IF NOT EXISTS target_format TEXT DEFAULT 'shortform',
  ADD COLUMN IF NOT EXISTS chapter_markers JSONB;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_videos_format ON videos(format, platform, vs_avg DESC);
CREATE INDEX IF NOT EXISTS idx_content_history_format ON content_generation_history(target_format, updated_at DESC);

NOTIFY pgrst, 'reload schema';
```

### .env.local 추가 키

```env
# 롱폼 전용 n8n 웹훅 (W08과 분리)
N8N_WEBHOOK_LONGFORM_DEDICATED=http://localhost:5678/webhook/longform-dedicated

# 캐러셀 전용 n8n 웹훅
N8N_WEBHOOK_CAROUSEL_GENERATE=http://localhost:5678/webhook/carousel-generate

# (미래) Higgsfield API
HIGGSFIELD_API_KEY=
```

---

## 6. 우선순위 로드맵

### 즉시 착수 (1~2주)

1. **DB 마이그레이션 14 실행** — 위 SQL 적용
2. **UI 숏폼/롱폼 탭 추가** — 콘텐츠 가이드 뷰 `intent` 토글 (코드 변경 최소)
3. **n8n W08 롱폼 프롬프트 분기** — 기존 워크플로에 `targetFormat` 조건 분기만 추가
4. **Higgsfield 복사 버튼 명시화** — `flowPasteBlock` 카드에 "클립보드 복사" 버튼

### 중기 (3~4주)

5. **n8n 롱폼 전용 워크플로** (N8N_LONGFORM_DEDICATED) 분리 · 챕터 마커 생성
6. **n8n 캐러셀 워크플로** (N8N_CAROUSEL_GENERATE) 신규 생성
7. **롱폼 vs_avg 분리 계산** — 아웃라이어 태깅 워크플로 수정
8. **YouTube 챕터 마커 자동 포맷** — 생성 결과에 설명란 복사 블록 추가

### 장기 (5~8주)

9. **Instagram Insights 수집** — Business 계정 연동 후 캐러셀 저장수 자동 수집
10. **캐러셀 이미지 생성** — Gemini Imagen API 또는 Ideogram API n8n 연동
11. **YouTube Analytics API** — 롱폼 평균 시청 시간 수집
12. **Higgsfield API** — 공개 시점에 n8n 워크플로 추가

---

## 7. 의존성 맵

```
숏폼 파이프라인 (완성)
  └── 롱폼 파이프라인
        ├── L-1-1 DB 마이그레이션       ← 선행 조건 (다른 모든 롱폼 작업의 전제)
        ├── L-2-1 n8n 전용 워크플로     ← L-1-1 이후
        ├── L-2-2 API 라우팅 분리       ← L-2-1 이후
        ├── L-2-3 UI 토글               ← L-2-2 이후 (독립 진행 가능)
        └── L-3-x 성과 추적             ← L-1-2 이후

  └── 캐러셀 파이프라인
        ├── C-1-1 Instagram 수집        ← 선행 조건 (Business 계정 확인 먼저)
        ├── C-2-1 n8n 워크플로          ← C-1-1과 병렬 가능
        ├── C-2-2 UI 흐름               ← C-2-1 이후
        └── C-3-x 성과 추적             ← C-1-1 이후

Higgsfield 연동
  └── 단기: UI 복사 버튼               ← 즉시 가능 (독립)
  └── 중기: n8n API 호출               ← API 공개 대기
```

---

## 8. 핵심 판단 포인트

**롱폼을 먼저 할지, 캐러셀을 먼저 할지:**

- 롱폼은 **인프라가 절반 있어서** 투입 대비 빠르게 결과물이 나옴
- 캐러셀은 **Instagram API 제약**이 변수. Business 계정·앱 승인 없이는 저장수 수집 불가  
  → 수집 없이 생성만 하는 캐러셀은 Gems와 차이가 없어짐

**추천 순서:** 롱폼 UI + n8n 분기 → 롱폼 성과 추적 → 캐러셀 생성 → 캐러셀 수집

**Gems vs 대시보드 차이를 유지하는 조건:**  
생성 결과가 Supabase에 쌓이고, 아웃라이어 데이터와 연결되며, 히스토리로 재사용 가능해야 함.  
그렇지 않으면 Gems와 동일한 일회성 도구가 됨. **저장·분석·재사용**이 이 대시보드의 존재 이유.
