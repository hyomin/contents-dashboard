# Contents Dashboard — 문서

프로젝트 관련 SQL·n8n·가이드·진행 요약을 한곳에서 관리합니다.

## 바로가기

| 문서 | 설명 |
|------|------|
| **[SUMMARY.md](./SUMMARY.md)** | **현재 현황 요약** (진입점 · 2026-05-31) |
| [guides/DASHBOARD_OVERVIEW_20260530.md](./guides/DASHBOARD_OVERVIEW_20260530.md) | 화면·API·DB·n8n **상세 맵** |
| [guides/CONTENT_CREATION_PIPELINE_RECOVERY.md](./guides/CONTENT_CREATION_PIPELINE_RECOVERY.md) | 콘텐츠 생성 파이프라인 복구 |
| [CHANGELOG.md](./CHANGELOG.md) | 날짜별 작업 이력 |
| [migrations/](./migrations/) | Supabase SQL (`00`~`12`) |
| [n8n/](./n8n/) | n8n 워크플로 JSON·설정 |
| [guides/DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md) | 대시보드·n8n 사용법 |
| [YOUTUBE_SHORTS_BENCHMARK_CHANNELS_20260531.md](./YOUTUBE_SHORTS_BENCHMARK_CHANNELS_20260531.md) | **Shorts 벤치마크** 채널 (국내·해외) |

## 디렉터리 구조

```
docs/
├── README.md              ← 이 파일
├── SUMMARY.md             ← 현황 요약 (먼저 읽기)
├── CHANGELOG.md
├── PROJECT_REPORT_20260524.md
├── migrations/            ← 00 ~ 12
├── guides/
│   ├── DASHBOARD_OVERVIEW_20260530.md
│   ├── CONTENT_CREATION_PIPELINE_RECOVERY.md
│   ├── DASHBOARD_USAGE.md
│   └── n8n-research.html
└── n8n/workflows/

archive/                   ← Agent 스냅샷 (Git 제외)
└── agent-snapshots/YYYYMMDDHHMMSS/
```

## 신규 환경 DB 세팅

1. `migrations/00-schema-full.sql` — 최초 1회
2. 이미 `00` 적용 DB → `01`~`12` 중 필요한 것만 실행

자세한 내용: [migrations/README.md](./migrations/README.md)

## Agent 스냅샷

생성 파일 복사본은 **`archive/agent-snapshots/`** 에만 둡니다.  
프로젝트 루트에 `20260*` 폴더를 만들지 않습니다. → [../archive/README.md](../archive/README.md)
