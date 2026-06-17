# Contents Dashboard — 문서

SQL·n8n·가이드·현황을 한곳에서 관리합니다.

## 시작하기

| 문서 | 설명 |
|------|------|
| **[SUMMARY.md](./SUMMARY.md)** | **현황 요약·우선순위** (진입점) |
| [guides/DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md) | 일상 사용·n8n 타이밍·세팅 |
| [guides/CONTENT_PRODUCTION_AZ_CHECKLIST.md](./guides/CONTENT_PRODUCTION_AZ_CHECKLIST.md) | A-Z 실행 체크리스트 |

## 참고

| 문서 | 설명 |
|------|------|
| [guides/DASHBOARD_OVERVIEW.md](./guides/DASHBOARD_OVERVIEW.md) | 화면·API·DB·n8n·콘텐츠 파이프라인 상세 맵 |
| [n8n/README.md](./n8n/README.md) | 워크플로 W01~W10 |
| [migrations/README.md](./migrations/README.md) | Supabase SQL (`00`~`15`) |
| [guides/YOUTUBE_BENCHMARK_CHANNELS.md](./guides/YOUTUBE_BENCHMARK_CHANNELS.md) | Shorts 벤치마크 채널 |
| [../guidelines/](../guidelines/) | 콘텐츠 가이드라인 MD (Agent 프롬프트 원본) |

## 이력

| 문서 | 설명 |
|------|------|
| [CHANGELOG.md](./CHANGELOG.md) | 날짜별 변경 이력 |

## 디렉터리 구조

```
docs/
├── README.md              ← 이 파일
├── SUMMARY.md             ← 현황 (먼저 읽기)
├── CHANGELOG.md
├── migrations/            ← 00 ~ 15
├── guides/
│   ├── DASHBOARD_OVERVIEW.md       ← 화면·API·파이프라인 상세
│   ├── DASHBOARD_USAGE.md          ← 일상 사용법·세팅
│   ├── CONTENT_PRODUCTION_AZ_CHECKLIST.md
│   └── YOUTUBE_BENCHMARK_CHANNELS.md
├── research/              ← 리서치 문서
└── n8n/workflows/         ← JSON

archive/                   ← Agent 스냅샷 (Git 제외)
└── agent-snapshots/
```

## 신규 환경 DB 세팅

1. `migrations/00-schema-full.sql` — 최초 1회
2. 이미 `00` 적용 DB → `01`~`15` 중 필요한 것만 실행

자세한 내용: [migrations/README.md](./migrations/README.md)

## Agent 스냅샷

생성 파일 복사본은 **`archive/agent-snapshots/`** 에만 둡니다.  
→ [../archive/README.md](../archive/README.md)
