# 대시보드 개발 세션 요약

> 기간: 2026-06-13 ~ 2026-06-17  
> 프로젝트: `dashboard-app` (Next.js · TypeScript · Supabase · ECharts)

---

## 1. HTML 미리보기 기능 ("HTML 보기")

### 목적
생성된 콘텐츠(마크다운)를 발행 전 이미지 포함 완성 HTML 형태로 새 탭에서 미리볼 수 있게 함.

### 구현 내용
| 항목 | 내용 |
|---|---|
| 렌더러 | `lib/dashboard/content-html-render.ts` 신규 생성 — `renderContentOutputHtml()` |
| API 라우트 | `app/api/dashboard/content-output-html/route.ts` — `GET ?historyId=<id>` |
| 마크다운 변환 | `marked` 라이브러리, `📊`/`📷` 가이드 블록 정규식 전처리 |
| 차트 이미지 삽입 | `output_N.png` 가이드 블록 → `/api/dashboard/stock-output-image?path=...` 실 이미지 |
| 가이드 블록 | 차트 미생성 또는 비주식 카테고리 → `📌 직접 제작 필요` 안내 카드 |
| 디스클레이머 | `※ 본 콘텐츠는 투자 판단에...` 문단 → amber 색상 박스 자동 변환 |
| UI 버튼 | `GenerationResultView`, `GenerationHistoryList`, `StockReportPanel` 에 "🖼️ HTML 보기" 버튼 추가 |

### 영향 파일
- `lib/dashboard/content-html-render.ts` (신규)
- `app/api/dashboard/content-output-html/route.ts` (신규)
- `lib/data/generation-history-queries.ts` — `getGenerationHistoryById()` 추가
- `lib/dashboard/generation-history-types.ts` — `chartIndexes`, `chartImages` 필드 추가
- `app/api/dashboard/stock-report/route.ts` — `chartImages` 저장 로직
- `app/api/dashboard/stock-report-focus/route.ts` — `chartImages` 저장 로직
- `components/dashboard/GenerationResultView.tsx`
- `components/dashboard/views/ContentCreationGuideView.tsx`
- `components/dashboard/GenerationHistoryList.tsx`
- `components/dashboard/StockReportPanel.tsx`

---

## 2. 차트 4번 — 추세 방향성 리디자인

### 배경
기존 4번 차트(단일 선형회귀 + "추정 구간" 음영 박스)가 너무 단편적이고 신뢰도가 낮아 보여 개선 요청.

### 구현 결정 (방안 1만 최종 채택)
| 구분 | 내용 |
|---|---|
| 방안 1 (채택) | **추세 시나리오형** — 현재가에서 긍정/기본/부정 3개 라인이 팬(fan) 형태로 분기, 변동성(σ) 기반 분기 폭, "현재" 구분선 표시 |
| 방안 2 (→ 삭제) | 암시적 표현형 (역사적 추세선만, 미래 연장 없음) — 비교 테스트 후 사용자가 삭제 결정 |

### 채택된 차트 스펙
- 회귀 윈도우: 최근 30거래일
- 예측 구간: 10거래일
- 시나리오 분기 폭: `volatility × √step × 1.2` (변동성 기반 성장)
- 색상: 긍정=빨강(`#f87171`), 기본=금색(`#fbbf24`), 부정=파랑(`#38bdf8`)
- 푸터: "기준: YYYY-MM-DD HH:mm" (이전 "생성:" 표현에서 변경)

### 영향 파일
- `lib/dashboard/stock-chart-render.ts` — `buildTrendScenarioChart()` 신규, `buildTrendImplicitChart()` 추가 후 삭제
- `lib/dashboard/stock-output-paths.ts` — `stockChartFileName()` 원상복구

---

## 3. 이미지 클릭 확대 (라이트박스)

### 구현
HTML 미리보기 내 모든 차트 이미지 클릭 시 전체화면 오버레이로 확대.

| 항목 | 내용 |
|---|---|
| 트리거 | `onclick="openLightbox(this.src)"` + `cursor: zoom-in` |
| 오버레이 | `.lightbox-overlay` (fixed, z-index 1000, 배경 클릭으로 닫힘) |
| 적용 범위 | `content-html-render.ts` 내 모든 차트 이미지 |

### 영향 파일
- `lib/dashboard/content-html-render.ts` — CSS, overlay div, `openLightbox`/`closeLightbox` 스크립트 추가

---

## 4. 표현 변경 — "생성:" → "기준:"

### 변경 이유
"생성" 시점보다 데이터 "기준" 시점임을 명확히.

### 변경 위치 (6곳)
| 파일 | 위치 |
|---|---|
| `lib/dashboard/stock-chart-render.ts` | 차트 PNG 하단 푸터 5곳 (가격·거래량·등락률·시나리오1·시나리오2) |
| `lib/dashboard/content-html-render.ts` | HTML 문서 헤더 메타 1곳 |

---

## 5. 시세 표 개선 (3가지)

### 5-1. 증감 색상 자동 적용
- "전일대비 등락률 (%)" 열 자동 감지 → 양수=빨강(`#dc2626`), 음수=파랑(`#2563eb`), 0=회색(`#6b7280`)
- 한국 증시 관례 기준 (양수=빨간색)
- HTML 후처리(`colorizeChangeColumns()`)로 구현 — AI 생성 마크다운 표를 파싱해 색상 클래스 부여

### 5-2. 표시 기간 축소 (20일 → 10일)
- `DAILY_PROMPT_DAYS`: 20 → 10 (`stock-report/route.ts`)
- `FOCUS_PROMPT_DAYS`: 20 → 10 (`stock-report-focus/route.ts`)
- 표 높이 과도 점유 문제 해결

### 5-3. 시가(시작가) 열 추가
- `StockSeriesForPrompt['bars']`에 `open: number` 필드 추가
- 가이드라인 3곳 표 열 구성 명시: "날짜 | 시가 | 종가 | 전일대비 등락률"
- AI 프롬프트 데이터에 시가 포함 (`formatSeriesBlock` 업데이트)

### 영향 파일
- `lib/data/stock-collect.ts` — `StockSeriesForPrompt` 타입, `getStockSeriesForReport()`
- `app/api/dashboard/stock-report/route.ts`
- `app/api/dashboard/stock-report-focus/route.ts`
- `lib/dashboard/stock-report-generate.ts` — `formatSeriesBlock()`
- `guidelines/contents_guideline.md` — 표 열 구성 명시 (3곳)
- `lib/dashboard/content-html-render.ts` — `colorizeChangeColumns()`, CSS 클래스

---

## 6. 차트 PNG 디자인 리뉴얼 (Navy/Premium)

> 이전 세션(2026-06-13)에 완료된 내용

- 네이비 그라디언트 배경, 골드 액센트 라인
- 폰트 크기 전체 상향 (범례 15pt, 축 13pt, 슬라이드 타이틀 30pt)
- 상승=빨강(`#f87171`), 하락=파랑(`#38bdf8`) — 한국 관례 적용

---

## 7. 검토 중 / 미구현 사항

### 7-1. 지수 4종 루틴 자동 발행
| 항목 | 상태 |
|---|---|
| KOSPI / KOSDAQ / S&P500 / NASDAQ | 현재 워치리스트에 포함됨 (`DEFAULT_STOCK_WATCHLIST`) |
| 루틴화 방법 | 워치리스트를 4개 지수로 고정하거나 `asset_type: 'index'`만 필터링해 일별 발행 |
| 난이도 | 낮음 — 기존 `stock-report` API 재사용 |

### 7-2. 이슈 기반 5종목 자동 선정 (미구현)
| 항목 | 내용 |
|---|---|
| 목표 | ESG·사고·긍정신호(실적/신제품)·MOU 관련 기업 5개를 일일 자동 선정해 리포트 생성 |
| 필요 파이프라인 | RSS 수집 → Gemini 기업명 추출+이슈 분류 → 섹터 디렉토리 티커 매핑 → 상위 5개 → 포커스 리포트 |
| 활용 가능 자산 | `rss-topic-collect.ts`, `stock-sector-directory.ts` (~60개 KR 종목 이름↔티커) |
| 주요 리스크 | 매핑 풀 외 중소형주 누락, 매칭 실패 시 5개 미충족(폴백 필요), Gemini 호출 1회 추가 |
| 다음 단계 | 매핑 풀 범위(현 60종 → 확장 여부) 결정 후 구현 착수 |

---

## 아키텍처 현황 (주요 경로)

```
stock-report (일일, 워치리스트 전체)
  └─ GET /api/dashboard/stock-report
  └─ renderDailyItemCharts() → stock/<date>/daily/{chart,slide}/

stock-report-focus (개별 분석, 1~3종목 또는 섹터)
  └─ POST /api/dashboard/stock-report-focus
  └─ renderResearchReportCharts() → stock/<date>/research/{chart,slide}/

content-output-html (HTML 미리보기)
  └─ GET /api/dashboard/content-output-html?historyId=<id>
  └─ renderContentOutputHtml() → standalone HTML
     ├─ 차트 이미지 삽입 (stock-output-image API 경유)
     ├─ 등락률 색상 자동 적용
     └─ 이미지 라이트박스

차트 렌더링 (서버사이드 PNG)
  └─ lib/dashboard/stock-chart-render.ts
     ├─ 1번: 가격 추이 & 이동평균선 (MA5/20/60)
     ├─ 2번: 거래량 (상승=빨강/하락=파랑)
     ├─ 3번: 일별 등락률(%) + 평균선
     └─ 4번: 추세 시나리오 (긍정·기본·부정 분기선)
```

---

## 기술 스택 요약

| 구분 | 기술 |
|---|---|
| 프레임워크 | Next.js App Router (TypeScript) |
| DB | Supabase (PostgreSQL) |
| 차트 렌더링 | Apache ECharts + @napi-rs/canvas (서버사이드 PNG) |
| AI | Google Gemini (콘텐츠 생성, RSS 정제) |
| 마크다운 | marked v18 |
| 스타일 | Tailwind CSS + Shadcn UI |
