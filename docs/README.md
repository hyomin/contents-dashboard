# Contents Dashboard — 문서

프로젝트 관련 SQL·n8n·가이드·진행 요약을 한곳에서 관리합니다.

## 바로가기

| 문서 | 설명 |
|------|------|
| [SUMMARY.md](./SUMMARY.md) | **현재까지 진행 사항 요약** (기능·n8n·DB·다음 단계) |
| [CHANGELOG.md](./CHANGELOG.md) | 날짜별 작업 이력 |
| [migrations/](./migrations/) | Supabase SQL 마이그레이션 |
| [n8n/](./n8n/) | n8n 워크플로 JSON·설정 |
| [guides/](./guides/) | 참고 자료·로드맵 HTML |
| [guides/DASHBOARD_USAGE.md](./guides/DASHBOARD_USAGE.md) | **대시보드·n8n 사용법 (화면·타이밍)** |

## 디렉터리 구조

```
docs/
├── README.md              ← 이 파일
├── SUMMARY.md             ← 현황 요약
├── CHANGELOG.md           ← 변경 이력
├── migrations/
│   ├── README.md
│   ├── 00-schema-full.sql
│   ├── 01-workspace.sql
│   ├── 02-channel-categories.sql
│   ├── 03-video-format.sql
│   ├── 04-outlier-tags.sql
│   └── 05-rss-topic-candidates.sql
├── guides/
│   ├── DASHBOARD_USAGE.md
│   └── n8n-research.html
└── n8n/
    ├── README.md
    └── workflows/
        ├── N8N_YOUTUBE_COLLECT.json
        ├── N8N_OUTLIER_TAGGING.json
        └── N8N_TOPIC_SUGGEST.json   (보관·재임포트 대기)
```

## 신규 환경 DB 세팅 순서

1. `migrations/00-schema-full.sql` — 전체 스키마 (최초 1회)
2. 이미 `00` 적용된 DB라면 `01`~`04`만 필요한 것만 실행

자세한 내용은 [migrations/README.md](./migrations/README.md) 참고.
