# 주식 일일 리포트 기능 전체 검토 리포트

> 작성일: 2026-06-20  
> 검토 범위: 아웃풋 파이프라인, n8n 연동, 코드 품질, 미완성 항목

---

## 1. 전체 아키텍처 흐름

```
[n8n W11 스케줄] ─── POST /api/dashboard/stock-collect
     KST 15:35 평일           │
                         runStockCollect()
                         ├── KR: 네이버 금융 fchart API (키 불필요)
                         │   └── fetchNaverDailySeries()
                         └── US: 네이버 월드 API (1차, 키 불필요, 최대 60일, volume=0)
                             └── Alpha Vantage (폴백, 키 필요)
                             ┌── stock_daily_snapshots upsert (Supabase)
                             │
[n8n W12 스케줄] ─── GET /api/dashboard/stock-report-settings
    W11 완료 웹훅 or          │   auto_generate_enabled? / skip_until?
    KST 16:00 폴백           │
                    ──────── POST /api/dashboard/stock-report
                             │
                        ┌────┴───────────────────────────────────────┐
                        │  generateDailyItemReport (동시 2건 루프)    │
                        │                                            │
                        │  1. getStockBarsForChart (120일 OHLCV)     │
                        │  2. buildStockDailyItemReportPrompt        │
                        │     └── 최근 10일 시세 + RSS 경제토픽 8개  │
                        │  3. Gemini (0.5 temp, 8192 tokens, 90s)    │
                        │  4. parseStockReportResponse → JSON        │
                        │  5. renderStockChartPng × 4종 × 2변형     │
                        │     chart/: 차트 단독 (raw)                │
                        │     slide/: PPT 장표 (헤더/푸터 포함)      │
                        │  6. insertGenerationHistory                │
                        │     └── attachPolishedToHistory            │
                        └────────────────────────────────────────────┘
                             │
                     content_generation_history 저장
                             │
                     [수동] 대시보드 검토 → 네이버 블로그 발행
```

---

## 2. 아웃풋 파이프라인 상세

### 2-1. 차트 이미지 출력 구조

| 번호 | 이름 | 내용 | 데이터 |
|---|---|---|---|
| -1.png | 가격 추이 & 이동평균 | 종가선 + MA5(금)/MA20(녹)/MA60(보라) + 최종일 골드 수직선 | 120일 close |
| -2.png | 거래량 | 상승일=적색, 하락일=청색 막대. US 종목은 volume=0 안내 텍스트 | 120일 volume |
| -3.png | 일별 등락률(%) | 전일대비 등락 막대 + 평균선(점선) | 120일 changePct |
| -4.png | 추세 시나리오 | 최근 30일 선형회귀 + 10거래일 후 긍정/기본/부정 3시나리오 | 120일 close |

- **해상도**: 1280 × 720px
- **배경**: 짙은 남색 그라데이션(`#16213f` → `#0a1020`)
- **slide 변형**: 상단 90px 헤더(제목 + 부제) + 하단 38px 푸터(출처 + 생성시각)
- **chart 변형**: 헤더/푸터 없이 차트 단독 (범례만 유지)

**저장 경로**:
```
stock/<YYYY-MM-DD>/daily/chart/{종목명}-{1~4}.png   ← raw (차트 단독)
stock/<YYYY-MM-DD>/daily/slide/{종목명}-{1~4}.png   ← PPT 장표
stock/<YYYY-MM-DD>/research/chart/{종목명}-{1|4}.png ← 포커스/섹터 raw
stock/<YYYY-MM-DD>/research/slide/{종목명}-{1|4}.png ← 포커스/섹터 슬라이드
```

### 2-2. 실제 생성된 아웃풋 현황

| 날짜 | 타입 | 생성 종목 수 | 이미지 수 |
|---|---|---|---|
| 2026-06-13 | daily | 4종목 (KOSDAQ, NAVER, SK하이닉스, 삼성전자) | chart 16장 + slide 16장 = 32장 |
| 2026-06-14 | research | 5종목 (섹터 모드, -1/-4 선택) | chart 18장 + slide 18장 = 36장 |
| 2026-06-17 | daily | 6종목 (KOSPI/KOSDAQ + 4종목 + 한화시스템) | chart 24장 + slide 24장 = 48장 |
| 2026-06-17 | research | 2종목 (AlphabetInc, 삼성전자) | chart 8장 + slide 8장 = 16장 |
| 2026-06-18 | research | 13종목 (섹터·포커스 혼합) | chart 36장 + slide 36장 = 72장 |

> 2026-06-19~20 daily 아웃풋 없음 → **n8n 자동화 미동작 중** 확인

### 2-3. 포커스/섹터 모드 차트 분배 규칙

```typescript
// 기업 분석 모드: 종목 수에 따라 차트 종류 자동 조정
const CHART_INDEXES_BY_COUNT = {
  1: [1, 2, 3, 4],   // 1종목 → 4종 전체
  2: [1, 4],          // 2종목 → 가격+추세만
  3: [1],             // 3종목 → 가격만
}
// 섹터 분석 모드: 구성종목 5개 기준, 항상 [1, 4]
const SECTOR_CHART_INDEXES = [1, 4]
```

### 2-4. UI 아웃풋 흐름 (StockReportPanel)

```
1. 지수 지표 섹션
   └── KOSPI, KOSDAQ (네이버 금융 실시간)
       SPY, QQQ, DIA, IWM (네이버 월드 or Supabase 캐시)

2. 📈 주식 일일 리포트 섹션
   ├── 자동 리포팅 토글 (stock_report_settings)
   ├── 오늘만 건너뛰기 버튼
   ├── 내 워치리스트 카드 (KR/US 분리, 실시간 시세)
   ├── ✨ 오늘 리포트 생성 버튼
   │   └── 시세 없는 종목 자동 감지 → stock-report-single 트리거
   └── 결과 리스트
       ├── ✅ 성공: 제목 + chart/slide 수 + 데이터 날짜 + 경고
       │   ├── 🖼️ HTML 버튼 → content-output-html 새탭
       │   └── 📷 썸네일 버튼 → 모달 (slide-1 미리보기 + HTML 복사)
       └── ⏭ skip: 오류 메시지

3. 🔍 종목 분석 리포트 섹션
   ├── 기업 검색 탭: 1~3종목 선택 + 메모
   └── 섹터 분석 탭: 섹터 드롭다운 → 구성종목 자동 분석

4. 개별 지표 섹션 (RSS 24h 이슈 종목)
```

### 2-5. 슬라이드 → 블로그 발행 변환

`copySlideAsHtml()` — `/api/dashboard/stock-output-image`에서 이미지를 fetch → FileReader로 base64 변환 → `<figure>` HTML로 클립보드 복사

```html
<figure style="margin:0 0 16px;text-align:center;">
  <img src="data:image/png;base64,..." alt="삼성전자 차트 1"
       style="max-width:100%;height:auto;border-radius:8px;" />
  <figcaption style="font-size:12px;color:#888;margin-top:6px;">
    삼성전자 차트 1
  </figcaption>
</figure>
```

> ⚠️ base64 embed 방식이므로 파일 크기가 큼 (PNG 1장 ≈ 수백 KB → base64 ≈ 1.3배). Supabase Storage 업로드 후 URL 직접 삽입이 권장됨.

---

## 3. n8n 연동 현황 상세

### 3-1. 설정 현황

| 항목 | 값 | 상태 |
|---|---|---|
| `N8N_WEBHOOK_STOCK_COLLECT` | `http://localhost:5678/webhook/stock-collect` | ✅ `.env.local` 설정됨 |
| `N8N_WEBHOOK_STOCK_REPORT` | `http://localhost:5678/webhook/stock-report-auto` | ✅ `.env.local` 설정됨 |
| `ALPHA_VANTAGE_API_KEY` | 주석 처리됨 | ❌ 미설정 |
| `GEMINI_API_KEY` | 설정됨 | ✅ |
| `DASHBOARD_API_SECRET` | 설정됨 | ✅ |
| W11 메타데이터 (`live-workflows.ts`) | W11 `stock-collect` | ✅ 등록됨 |
| W12 메타데이터 (`live-workflows.ts`) | W12 `stock-report-auto` | ✅ 등록됨 |
| `N8N_STOCK_COLLECT.json` | — | ❌ 미작성 |
| `N8N_STOCK_REPORT.json` | — | ❌ 미작성 |
| `scripts/n8n-setup.sh` W11/W12 등록 | — | ❌ 미등록 |
| n8n 실제 배포·활성화 | — | ❌ 불가 (JSON 없음) |

### 3-2. W11 설계 (docs/n8n-stock-report-guide.md 기준)

```
Schedule Trigger (평일 KST 15:35 → UTC 06:35, cron: "35 6 * * 1-5")
       │  (US장 마감 후 추가: KST 06:00, cron: "0 21 * * 0-4")
       ▼
HTTP Request POST
  URL: {{ $env.DASHBOARD_API_URL }}/api/dashboard/stock-collect
  Headers: Authorization: Bearer {{ $env.DASHBOARD_API_SECRET }}
       │
       ▼
(선택) IF: response.ok === false → Notion 오류 로그
       │
       ▼
HTTP Request POST (W12 트리거)
  URL: {{ $env.DASHBOARD_API_URL }}/n8n/webhook/stock-report-auto
```

> **현재 미구현**: `stock-collect/route.ts`는 W12 웹훅을 직접 호출하지 않음. W11 JSON 안에서 W12 트리거 노드를 추가해야 함.

### 3-3. W12 설계 (docs/n8n-stock-report-guide.md 기준)

```
Webhook (stock-report-auto) ← W11 완료 시 트리거
  + Schedule 폴백 (KST 16:00, cron: "0 7 * * 1-5")
       │
       ▼
HTTP Request GET
  /api/dashboard/stock-report-settings
       │
       ▼
IF: auto_generate_enabled === true
    AND (skip_until == null OR skip_until < 오늘)
       │ true                    │ false
       ▼                         ▼
HTTP Request POST         종료 (스킵)
  /api/dashboard/stock-report
  Authorization: Bearer ...
       │
       ▼
(선택) Notion 로그: "리포트 N건 생성, 검토 필요"
```

---

## 4. 발견된 문제 및 개선 사항

### 🔴 P1 — 즉시 조치 필요

#### P1-1. n8n 워크플로 JSON 미작성 → 자동화 완전 미동작

- **현황**: W11/W12 메타데이터·가이드 문서는 완성됐지만 실제 n8n에 임포트할 JSON 파일이 없음
- **영향**: 장마감 자동 시세 수집·리포트 생성이 전혀 안 됨. 현재 모든 리포트가 수동 버튼 클릭으로만 생성됨
- **작업**: `docs/n8n/workflows/N8N_STOCK_COLLECT.json`, `N8N_STOCK_REPORT.json` 작성 → n8n에 임포트
- **참고**: `docs/n8n-stock-report-guide.md`에 노드 구성 상세 기술됨. W01~W07 JSON 패턴 재사용 가능

#### P1-2. Alpha Vantage API 키 미설정 → US 종목 거래량 0

- **현황**: `.env.local`에 `# ALPHA_VANTAGE_API_KEY=` 주석 처리
- **영향**: 
  - 네이버 월드 API는 volume을 제공하지 않아 US 종목 모두 `volume: 0` → 차트 2번(거래량)에 "거래량 데이터 없음" 표시
  - 네이버 월드에서 찾지 못하는 US 종목(일부 소형주 등)은 시세 자체 미수집
- **작업**: Alpha Vantage 무료 키 발급 후 `.env.local`에 추가. 무료 키 기준 분당 5회, 일 500회 제한 → 종목 수 고려 필요

---

### 🟡 P2 — 단기 개선 권장

#### P2-1. 차트 이미지 Supabase Storage 미연동 → 발행 시 이미지 깨짐

- **현황**: UI 썸네일 모달에 직접 경고 표시됨 (`⚠️ 이미지 URL이 로컬 전용`). 현재 base64 embed로 클립보드에 복사
- **영향**: 이미지를 네이버 블로그에 붙여넣으면 일단은 base64로 표시되지만, URL 방식이 아니라 글 편집이 무거워지고 글 크기가 커짐. 외부 URL 직접 연결 불가
- **작업**: `stock-output-image` route에서 서빙하는 PNG를 Supabase Storage에도 업로드하고, 공개 URL을 `chartImages` 배열에 추가

#### P2-2. stock-report-focus 이중 attachPolishedToHistory 호출

- **파일**: [app/api/dashboard/stock-report-focus/route.ts:214-229](../app/api/dashboard/stock-report-focus/route.ts)
- **현황**: 차트 렌더 전에 1차 attach, 차트 완료 후 chartImages 포함해서 2차 attach
- **영향**: 불필요한 DB 쓰기 1회. `attached` 변수 결과가 이후 `chartImages.length > 0`이면 무시됨
- **수정안**: 차트 렌더 먼저 실행 후 한 번만 attach

```typescript
// 현재 (비효율)
const attached = await attachPolishedToHistory(...)    // 1차
const charts = renderResearchReportCharts(...)
if (chartImages.length > 0) {
  const reattached = await attachPolishedToHistory(...) // 2차
}

// 수정 후
const charts = renderResearchReportCharts(...)          // 차트 먼저
const chartImages = charts.filter(...).map(...)
const attached = await attachPolishedToHistory(saved.item.id, {
  ...polishToHistory(polished),
  chartIndexes,
  ...(chartImages.length > 0 ? { chartImages } : {}),  // 한 번에
})
```

#### P2-3. 히스토리 ID 충돌 가능성

- **파일**: [lib/dashboard/stock-daily-report.ts:158](../lib/dashboard/stock-daily-report.ts)
- **현황**: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` — 동시 2건 처리 시 동일 ms에 실행되면 random 4자리(36진수)만 차이
- **수정안**: `crypto.randomUUID()` 사용

```typescript
// 현재
id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// 수정 후
id: crypto.randomUUID()
```

#### P2-4. US 종목 volume 처리 명시적 분기 없음

- **파일**: [lib/data/naver-finance-stock.ts:162](../lib/data/naver-finance-stock.ts)
- **현황**: 차트 렌더 시 `hasVolume = bars.some(b => b.volume > 0)` 체크 후 "거래량 데이터 없음" 텍스트 표시는 처리됨
- **추가 개선**: Alpha Vantage로 수집 시 volume 있음 → 키 설정 후 재수집 필요. UI에 "US 종목 거래량은 Alpha Vantage 키 필요" 안내 추가 고려

---

### 🟢 P3 — 중기 개선 (운영 안정화)

#### P3-1. 네이버 비공식 API 의존성 리스크

- **현황**: `https://fchart.stock.naver.com/sise.nhn` (국내), `https://api.stock.naver.com/stock` (미국) 모두 비공식 엔드포인트
- **영향**: 네이버 측 변경 또는 차단 시 전체 시세 수집 중단. 문서에 이미 경고 기재됨
- **대책**: 한국거래소(KRX) OpenAPI 또는 FinanceDataReader 대체 경로 확보. 장기적으로 공식 API로 전환

#### P3-2. 이미지 파일 서버 로컬 저장 (서버리스 배포 불가)

- **현황**: `writeFileSync(resolve(process.cwd(), 'stock', ...))` — 서버 로컬 파일시스템에 저장
- **영향**: Vercel 등 서버리스 배포 시 `/tmp` 외 쓰기 불가 → 차트 이미지 생성 실패
- **대책**: Supabase Storage 업로드 또는 별도 파일 서버. 현재 로컬 운영이면 즉각 문제 없음

#### P3-3. 동시성 2건 고정 (Gemini 레이트 리밋 vs 처리 속도 균형)

- **현황**: `DAILY_REPORT_CONCURRENCY = 2` — 워치리스트가 늘면 처리 시간 증가
- **예시**: 16종목 × (Gemini ~10초 + 차트 렌더 ~3초) ÷ 2 ≈ 약 104초
- **고려사항**: Gemini API 레이트 리밋(분당 60회 수준) 감안하면 2~3이 적정. 워치리스트 상한선(예: 20종목) 제한 안내 필요

#### P3-4. 데이터 신선도 경고 임계값 검토

- **현황**: `daysDiff >= 3`일 때 경고 (`dataWarning`) 발생
- **문제**: 월요일 리포트 생성 시 금요일 데이터 → 3일 차이 → 정상인데 경고 발생
- **수정안**: 영업일 기준으로 계산 (`daysDiff >= 5` 또는 영업일 계산 함수 사용)

---

## 5. 우선순위별 실행 계획

### 🔴 즉시 (이번 주)

| # | 작업 | 예상 소요 | 파일 |
|---|---|---|---|
| 1 | **W11 n8n JSON 작성** (stock-collect) | 1h | `docs/n8n/workflows/N8N_STOCK_COLLECT.json` |
| 2 | **W12 n8n JSON 작성** (stock-report-auto) | 1h | `docs/n8n/workflows/N8N_STOCK_REPORT.json` |
| 3 | **n8n에 임포트·활성화** + `scripts/n8n-setup.sh` 등록 | 0.5h | — |
| 4 | **Alpha Vantage API 키 설정** | 10분 | `.env.local` |

### 🟡 단기 (다음 주)

| # | 작업 | 예상 소요 | 파일 |
|---|---|---|---|
| 5 | **stock-report-focus 이중 attach 수정** | 30분 | `app/api/dashboard/stock-report-focus/route.ts` |
| 6 | **히스토리 ID → crypto.randomUUID()** | 10분 | `lib/dashboard/stock-daily-report.ts` |
| 7 | **Supabase Storage 업로드 연동** (차트 이미지 외부 URL) | 2~3h | `lib/dashboard/stock-output-paths.ts` + stock API routes |
| 8 | **데이터 신선도 경고 → 영업일 기준** 수정 | 20분 | `lib/dashboard/stock-daily-report.ts` |

### 🟢 중기 (이달 말)

| # | 작업 | 예상 소요 | 비고 |
|---|---|---|---|
| 9 | 네이버 비공식 API 대체 경로 조사 | 조사 필요 | KRX OpenAPI 또는 FinanceDataReader |
| 10 | 워치리스트 상한선 + UI 안내 추가 | 0.5h | 처리 시간 예측 표시 |
| 11 | n8n W12 완료 시 Notion 로그 연동 | 1h | W06 패턴 재사용 |

---

## 6. 현재 정상 동작하는 기능 요약

| 기능 | 상태 | 근거 |
|---|---|---|
| 국내 시세 수집 (네이버 금융) | ✅ 정상 | 6/13, 6/17 daily 차트 실제 생성 |
| 포커스/섹터 리포트 | ✅ 정상 | 6/14, 6/17, 6/18 research 차트 생성 |
| Gemini 리포트 생성 (일일/포커스/섹터) | ✅ 정상 | content_generation_history 저장 확인 |
| 차트 PNG 4종 렌더링 | ✅ 정상 | 모든 일별 PNG 생성 확인 |
| 슬라이드 → 블로그 HTML 클립보드 복사 | ✅ 정상 | base64 embed 방식으로 동작 |
| 자동생성 on/off 토글 | ✅ 정상 | stock_report_settings API 구현됨 |
| 오늘만 건너뛰기 | ✅ 정상 | skip_until 로직 구현됨 |
| 중복 리포트 방지 (409 + 재생성 confirm) | ✅ 정상 | force 옵션 동작 |
| 시세 없는 종목 자동 복구 (stock-report-single) | ✅ 정상 | autoCollecting 플로우 구현됨 |
| 워치리스트 관리 (추가/삭제) | ✅ 정상 | stock-watchlist CRUD 구현됨 |
| US 종목 시세 (네이버 월드 API) | ✅ 부분 정상 | volume=0, suffix 자동 탐지 캐시됨 |
| **n8n 자동 스케줄 (W11/W12)** | ❌ 미동작 | JSON 파일 미작성 |
| **US 종목 거래량** | ❌ 미수집 | Alpha Vantage 키 미설정 |
| **차트 이미지 외부 URL** | ❌ 미지원 | Supabase Storage 미연동 |

---

## 7. Phase 2 체크리스트

```
n8n 자동화 완성
─────────────────────────────────────────────────────────
[ ] docs/n8n/workflows/N8N_STOCK_COLLECT.json 작성
[ ] docs/n8n/workflows/N8N_STOCK_REPORT.json 작성
[ ] scripts/n8n-setup.sh에 W11/W12 등록
[ ] n8n Docker에 임포트 및 활성화
[ ] W11 → W12 웹훅 트리거 연결 동작 확인
[ ] 평일 KST 15:35 스케줄 테스트 (수동 트리거 → 결과 확인)

환경 설정
─────────────────────────────────────────────────────────
[ ] ALPHA_VANTAGE_API_KEY 설정 (무료 키 발급)
[ ] 키 설정 후 US 종목 재수집 → 거래량 차트 확인

코드 수정
─────────────────────────────────────────────────────────
[ ] stock-report-focus 이중 attachPolishedToHistory 제거
[ ] 히스토리 ID → crypto.randomUUID()
[ ] 데이터 신선도 경고 → 영업일 기준 계산

이미지 외부 URL (블로그 발행 최적화)
─────────────────────────────────────────────────────────
[ ] Supabase Storage 버킷 생성 (stock-charts, 공개)
[ ] 차트 렌더 후 Storage 업로드 + URL 반환
[ ] copySlideAsHtml에서 base64 대신 Storage URL 사용
[ ] docs/n8n/README.md 표에 W11/W12 행 추가
```
