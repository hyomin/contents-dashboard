# 콘텐츠 제작 — A-Z 액션 체크리스트

> **갱신:** 2026-06-12  
> 상세 설명: [CONTENT_CREATION_WORKFLOW.md](./CONTENT_CREATION_WORKFLOW.md)

---

## A. 소재 정하기
- [ ] 이미 주제가 있다 → **C로 건너뛰기**
- [ ] 없다 → `trending` · `outlier` · `ai-insight` · `topic-suggest` 탐색
- [ ] 기획 큐에 저장 → 가이드에서 이어받기

## B. (옵션) 레퍼런스 URL 분석
- [ ] 마음에 드는 영상·포스트 URL이 있다 → `content-analyzer`에서 분석
- [ ] BGM·감정·스토리 구조를 가이드 레퍼런스에 반영할지 결정
- [ ] `GEMINI_API_KEY` + `DASHBOARD_GEMINI_DIRECT=1` 설정 확인

## C. (옵션) 레퍼런스 모으기
- [ ] YouTube·블로그·웹 레퍼런스 추가 여부 결정
- [ ] "구조·톤만" / "내용까지" 모드 지정

## D. 콘텐츠 가이드에서 생성 (`content-guide`)
1. [ ] 카테고리·포맷 — blog / carousel / shortform / longform
2. [ ] (선택) AI 주제 카드 또는 **발행 주제 직접 입력** *(필수)*
3. [ ] (선택) 감정 톤·레퍼런스
4. [ ] AI 모델 — Flash(빠름) / Pro(고품질)
5. [ ] 생성 → `mode: ai-enhanced` 확인

## E. 숏폼·영상 — 제목·썸네일 점검
- [ ] 썸네일·제목 질문↔해답 구조
- [ ] 썸네일 5~7자, 0~3초 훅 회수
- [ ] `guidelines/contents_guideline.md` 바이럴 제목·썸네일 섹션 반영 확인

## F. (영상) 제작 진행 보드 (`production-tracker`)
- [ ] 6단계(기획→비주얼→나레이션→BGM→편집→자막) 상태·메모 기록

## G. 정제 (Polish)
- [ ] 가이드라인 형식·톤·이미지 가이드 수 확인
- [ ] 가이드라인 수정 시 `guidelines/contents_guideline.md`만 편집

## H. 히스토리 확인 (`generation-history`)
- [ ] draft·polished Supabase 저장 확인
- [ ] 필요 시 복사·재활용

## I. 발행 편집·변환 (`content-studio`)
- [ ] 최종 문장·메모·포맷 변환
- [ ] localStorage 저장 (원본은 히스토리에 보관)

## J. (숏폼) Google Flow 제작
- [ ] `flowPasteBlock` / 씬별 블록을 **Google Flow**에 붙여넣기 (Higgsfield 아님)
- [ ] 완성 영상 다운로드·편집 툴로 마감

## K. 발행 확장 (`publish-expand`)
- [ ] TikTok · Instagram · Blogger 가이드 확인
- [ ] 각 플랫폼에서 **수동 업로드**

## L. 일정·배포
- [ ] `calendar` 일정 등록
- [ ] (선택) `deploy` — n8n 로컬 의존

## M. 성과·재가공
- [ ] `outlier`에서 vs.Avg 추이 확인
- [ ] `repurpose`로 재가공 검토
