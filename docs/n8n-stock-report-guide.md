# n8n 워크플로 설계 가이드 — 주식 일일 리포트 (W11/W12)

> 이 문서는 **설계 가이드**입니다. 실제 n8n `.json` 워크플로 제작(`docs/n8n/workflows/N8N_STOCK_COLLECT.json`,
> `N8N_STOCK_REPORT.json`)과 `scripts/n8n-setup.sh` 등록은 **다음 세션(Phase 2)**에서 진행합니다.
> 코드 기준 메타데이터는 `lib/n8n/live-workflows.ts`의 W11/W12 항목을 참고하세요.

## 개요

| # | key | 역할 | 트리거 |
|---|-----|------|--------|
| W11 | `stock-collect` | 워치리스트(국내 네이버 금융 / 미국 Alpha Vantage) 일별 시세 수집 → `stock_daily_snapshots` | 장마감 후 스케줄 |
| W12 | `stock-report-auto` | 자동생성 설정 확인 → 주식 일일 리포트 생성·히스토리 저장 | W11 이후 스케줄 |

두 워크플로 모두 **대시보드 API를 호출하는 단순 구조**를 권장합니다. 시세 호출·정규화·Gemini 생성 로직은
이미 대시보드 쪽(`lib/data/naver-finance-stock.ts`, `lib/data/alpha-vantage-stock.ts`, `lib/data/stock-collect.ts`,
`lib/dashboard/stock-report-generate.ts`, `/api/dashboard/stock-*`)에 구현되어 있으므로, n8n은 **스케줄러 + 대시보드 API
호출 + (선택) 결과 알림** 역할만 맡으면 됩니다.

## W11. `stock-collect` 노드 구성

```
Schedule Trigger (KST 기준 2개 cron)
  ├─ 국내장 마감 후: 15:35 KST → cron "35 15 * * 1-5" (UTC 06:35, n8n 타임존 설정에 따라 조정)
  └─ 미국장 마감 후: 06:00 KST → cron "0 6 * * 2-6" (서머타임에 따라 05:00~06:00 사이, 분기별 점검)
        │
        ▼
HTTP Request (POST)
  URL: {{ $env.DASHBOARD_API_URL }}/api/dashboard/stock-collect
  Headers: Authorization: Bearer {{ $env.DASHBOARD_API_SECRET }}
        │
        ▼
(선택) IF: response.ok === false
        │
        ▼
(선택) Notion 로그 (W06 notion-log 패턴 재사용)
```

- 국내·미국을 **하나의 워크플로에서 시간대별 Schedule Trigger 2개**로 처리하거나, 단순화를 위해 **하루 1회**(미국장 마감 이후)
  실행해 양쪽을 한 번에 수집해도 됩니다 (`runStockCollect()`는 워치리스트 전체를 한 번에 처리).
- 국내 종목·지수 시세는 `lib/data/naver-finance-stock.ts`(네이버 금융 비공식 차트 API)로 수집하며 **별도 키가 필요 없습니다**.
  미국 종목/ETF만 `ALPHA_VANTAGE_API_KEY` 미설정 시 `{ ok: false, perTicker: [{ reason: 'not_configured' }] }`로
  graceful하게 표시되며, 워크플로 자체는 에러 없이 동작합니다 (단, 미국 종목 시세는 쌓이지 않음).

## W12. `stock-report-auto` 노드 구성

```
Schedule Trigger (W11 이후, 예: 16:30 KST 평일)
        │
        ▼
HTTP Request (GET) /api/dashboard/stock-report-settings
        │
        ▼
IF: auto_generate_enabled === true
    AND (skip_until == null OR skip_until < 오늘 날짜)
        │ true                              │ false
        ▼                                   ▼
HTTP Request (POST)                    (종료 — 아무 것도 하지 않음)
  /api/dashboard/stock-report
  Headers: Authorization: Bearer {{ $env.DASHBOARD_API_SECRET }}
        │
        ▼
(선택) Notion 로그 — "주식 일일 리포트 생성됨, 검토 필요" 알림
```

- `/api/dashboard/stock-report` POST는 `GEMINI_API_KEY` 미설정 시 503을 반환합니다 — 대시보드 `.env.local`에
  `GEMINI_API_KEY`가 설정되어 있어야 W12가 정상 동작합니다 (n8n Docker 환경이 아닌 **대시보드 프로세스**의 키 사용).
- **응답 형식**: 워치리스트 통합 1건이 아니라 **종목/지수별 개별 리포트 N건**을 생성합니다 —
  `{ reportDate, items: [{ ticker, market, name, ok, historyId, title, chartFiles, slideFiles, error? }, ...] }`.
  개별 항목 실패는 `ok: false`로 기록되며 나머지 항목 생성은 계속 진행됩니다.
- 각 항목은 `content_generation_history`에 `category: 'writing'`, `publishTopic: 'YYYY-MM-DD {종목/지수명} 일일 리포트'`로
  저장됩니다 — **발행(네이버/티스토리/Blogger)은 항상 수동**: 대시보드 «내 콘텐츠 생성 → 글쓰기 → 주식 일일 리포트» 결과
  리스트의 "에디터에서 보기" 또는 히스토리 목록에서 결과를 확인 후 `BlogPlatformPackage`로 복사·게시합니다.
- 차트 이미지는 종목/지수별로 **차트(raw) PNG와 PPT 슬라이드 PNG를 함께** 생성해
  `stock/<reportDate>/daily/chart/{종목명}-{1~4}.png`, `stock/<reportDate>/daily/slide/{종목명}-{1~4}.png`에
  저장됩니다(상대경로는 `items[].chartFiles`/`slideFiles`로 반환). 「종목 분석 리포트」(포커스/섹터 모드,
  `/api/dashboard/stock-report-focus`)의 차트는 동일한 규칙으로 `stock/<reportDate>/research/{chart,slide}/`에 저장됩니다.

## 사용자 개입 지점 (자동/수동 컨트롤)

대시보드 «내 콘텐츠 생성 → 글쓰기 → 📈 주식 일일 리포트» 모드 상단에서:

- **"자동 생성(n8n) 사용" 토글 OFF** → `stock_report_settings.auto_generate_enabled = false` → W12가 위 IF에서
  걸러져 자동 생성을 건너뜁니다. 사용자는 같은 화면의 "오늘 리포트 생성" 버튼으로 언제든 수동 생성 가능.
- **"오늘만 건너뛰기"** → `stock_report_settings.skip_until = 오늘 날짜` → 오늘 1회만 W12 자동 생성을 건너뛰고,
  다음 날부터 다시 자동 생성됩니다.
- 자동/수동 생성 결과 모두 **히스토리에만 저장**되며, 실제 발행은 사용자가 검토 후 직접 진행합니다.

## 필요 환경변수 (`.env.local`)

| 변수 | 용도 | 비고 |
|---|---|---|
| `ALPHA_VANTAGE_API_KEY` | 미국 주식 시세 (TIME_SERIES_DAILY) | 무료 키 (호출 빈도 제한 있음). 국내 종목/지수는 키 불필요(네이버 금융 API) |
| `STOCK_COLLECT_LOOKBACK_DAYS` | 종목당 수집 기간(일) | 기본 60일 |
| `N8N_WEBHOOK_STOCK_COLLECT` | W11 webhook URL (선택) | 미설정 시 대시보드 API 폴백 |
| `N8N_WEBHOOK_STOCK_REPORT` | W12 webhook URL (선택) | 미설정 시 대시보드 API 폴백 |
| `GEMINI_API_KEY` | 리포트 생성(Gemini) | W12가 `/api/dashboard/stock-report` 호출 시 대시보드 프로세스에 필요 |
| `DASHBOARD_API_SECRET` | n8n → 대시보드 API 인증 | 기존 변수 재사용 |

## 국내 시세 — 네이버 금융 비공식 차트 API

`lib/data/naver-finance-stock.ts`가 `https://fchart.stock.naver.com/sise.nhn`을 호출해 일별 OHLCV를 가져옵니다.
별도 가입·키 발급이 필요 없습니다.

- 종목: 6자리 종목코드(예: `005930`) 그대로 사용.
- 지수: 워치리스트의 KIS식 코드(`0001`=KOSPI, `1001`=KOSDAQ)를 네이버 심볼(`KOSPI`/`KOSDAQ`)로 매핑합니다.
- **주의**: 비공식 엔드포인트이므로 네이버 측 변경/차단 시 동작이 멈출 수 있습니다 — 이 경우
  `runStockCollect()`의 해당 종목은 `ok: false, reason: 'request_failed'`로 표시되며 다른 종목 수집은 계속됩니다.

## Phase 2 TODO

- [ ] `docs/n8n/workflows/N8N_STOCK_COLLECT.json` 작성 (위 W11 노드 구성)
- [ ] `docs/n8n/workflows/N8N_STOCK_REPORT.json` 작성 (위 W12 노드 구성)
- [ ] `scripts/n8n-setup.sh`에 두 워크플로 등록
- [ ] `docs/n8n/README.md` 표에 W11/W12 행 추가
