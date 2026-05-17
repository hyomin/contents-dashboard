# 프로젝트 진행 상황

## 2026-05-17 완료 사항

### 파일 정리
- 루트의 분산된 SQL / JSON / MD 파일 → `docs/` 폴더로 통합
- 일회성 설치 가이드 (SETUP_GITHUB, SETUP_SUPABASE, CREATE_TOKEN 등) 삭제
- SQL 2개(CREATE_TABLES, UPDATE_TABLES) → `docs/schema.sql` 단일 파일로 통합
- N8N JSON 2개 → `docs/n8n/` 폴더로 이동
- README.md 현행화

---

## 2026-05-10 ~ 2026-05-14 완료 사항

### 1. 개발 환경 구축
- Next.js + TypeScript + Tailwind CSS + Shadcn UI 세팅
- Supabase 연결 (`rxmqhkiepfqiaatopunb.supabase.co`)
- GitHub 레포 연동 (`hyomin/contents-dashboard`)

### 2. 대시보드 UI
- 왼쪽 사이드바 트리 네비게이션 구현
- Overview, 플랫폼별 분석, 아웃라이어, 트렌드, AI 인사이트, 경쟁채널, 내채널, 캘린더, 데이터수집, 수익, 리퍼포징, 배포 뷰 구현
- vs.Avg 지표 기반 티어(S/A/B/C) 색상 시각화
- 벤치마킹 카테고리 커스텀 등록 UI

### 3. 코드 구조 개선
- `page.tsx` 945줄 → 95줄로 리팩토링
- 뷰 컴포넌트 파일 분리 (`components/dashboard/views/`)
- 공유 타입/헬퍼/더미데이터 `lib/` 분리

### 4. n8n 연동
- YouTube Data API v3 채널/영상 수집 워크플로 구현
- AI 주제선별 워크플로 (Webhook + OpenAI) 구현
- Docker n8n 환경변수 기반 API 키 관리

### 5. YouTube 데이터 파이프라인
- 수집 대상 5개 채널 설정 (슈카월드, 삼프로TV, 신사임당, 부읽남TV, 박곰희TV)
- Supabase `channels`, `videos` 테이블 스키마 확정
- vs.Avg 계산 및 S/A/B/C 티어 자동 분류

---

## 현재 상태 (2026-05-17)

| 항목 | 상태 |
|------|------|
| 대시보드 UI | ✅ 완료 (더미 데이터) |
| Supabase 연결 | ✅ 완료 |
| YouTube 수집 n8n 워크플로 | 🔄 디버깅 중 (HTTP 저장 방식 수정) |
| AI 주제선별 워크플로 | ✅ 구현 완료 (API 키 연결 필요) |
| 실제 데이터 대시보드 연동 | ⏳ 대기 |

---

## 다음 단계

1. **n8n YouTube 수집 워크플로 검증** – `docs/n8n/N8N_YOUTUBE_COLLECT.json` 임포트 후 실행 확인
2. **대시보드 실제 데이터 연동** – Supabase에 쌓인 데이터를 API로 불러와 UI 갱신
3. **Instagram/블로그 수집 파이프라인** – Apify 또는 RSS 기반 수집 추가
4. **콘텐츠 캘린더** – 발행 스케줄 관리 기능 구현
