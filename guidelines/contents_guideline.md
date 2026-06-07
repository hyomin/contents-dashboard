---
# Agent·발행용 콘텐츠 가이드라인 (편집용)
# 이 파일을 수정하면 «내 콘텐츠 생성» Gemini 프롬프트에 반영됩니다.
# dev 서버 재시작 없이 저장 후 다음 생성 요청부터 적용됩니다.
blog_image_guide_count: 3
---

# contents_guideline

> **경로:** `dashboard-app/guidelines/contents_guideline.md`  
> **대상:** 블로그(`writing`) · 숏폼(`video` / shortform) Agent 프롬프트  
> **숏폼 영상 생성:** Google AI Pro · **Google Flow**(Veo) — Higgsfield 아님  
> **플랫폼 스펙(최우선):** `guidelines/platform_shortform_specs.md` — [Branderkey Notion](https://branderkey.notion.site/33c835c9591a8008b0cef37fcf50043f)  
> **UI 체크리스트:** 콘텐츠 가이드 화면 «포맷별 제작 가이드»는 `lib/dashboard/content-creation-guide.ts`와 동기화하려면 수동 맞춤 또는 추후 연동

---

<!-- agent:common -->

## 공통 작성 원칙 (모든 포맷)

1. «OO 채널», «벤치마킹», «레퍼런스» 등 메타 표현 금지. 독자·시청자에게 직접 말하는 **발행용 톤**.
2. **구조·톤 레퍼런스**의 채널명·타 채널·영상·블로그 제목·표현은 본문에서 **완전히 제거**하거나 새 표현으로 바꿉니다.
3. **내용 레퍼런스**의 사실·수치·설명은 발행 주제에 맞게 **유지**하되, 출처·사이트명·URL·직접 인용 없이 **새 문장**으로 씁니다.
4. 표절·문장 복사 없이 사실·논지만 유지합니다.

---

<!-- agent:blog -->

## 블로그 발행 가이드 (writing / blog)

### 방향

블로그·카드뉴스·게시글은 «검색 의도에 답하는 제목»과 «스캔 가능한 본문 구조»가 핵심입니다. 참고 레퍼런스의 **제목·소제목 패턴만** 구조적으로 벤치마킹하고, 정보는 직접 조사한 사실로 채웁니다.

### 체크리스트 (Agent가 본문에 반영)

- 핵심 키워드 1개를 제목 앞 15자 안에 배치
- 첫 2문단 안에 결론·핵심 수치(요약) 제시 — «결론부터»
- H2 소제목 3~6개, 각 소제목 아래 3~5문장 또는 번호 목록
- 표·비교표·체크리스트로 정보 밀도 올리기 (체류 시간↑)
- 본문 중간 1곳에 내부 링크 또는 관련 글 언급
- 마지막 단락: 다음 행동(댓글·구독·저장·공유) 한 줄 CTA
- 레퍼런스 제목 패턴(숫자·질문·대비) 중 1개를 내 제목에 적용

### 제목 공식 (고성과 패턴)

- 숫자형: «2026년 ○○ 5가지» / «월 ○만원 절약하는 방법»
- 질문형: «왜 지금 ○○일까?» / «○○, 정말 효과 있을까?»
- 대비형: «○○ vs △△, 뭐가 나을까» / «전문가 vs 초보 차이»
- 시한성: «올해 말 전에» / «○월부터 바뀌는» — 트렌드 키워드와 결합

### 네이버 블로그 / 티스토리

- 썸네일·대표 이미지: 제목과 같은 메시지, 텍스트 3~5단어 이내
- 첫 H2 전 150~200자: 검색 의도에 대한 직접 답변 (AI 요약·스니펫 대비)
- 키워드 반복보다 동의어·관련어·LSI 키워드 자연 배치
- 목차(네이버): H2 4개 이상이면 자동 목차 활성화
- 티스토리: 카테고리·태그 3~5개, 메타 설명 120자 이내

### Google Blogger (발행 확장)

네이버·콘텐츠 가이드 초안을 **Google 검색·AdSense**용으로 미러 발행할 때 적용합니다. 본문 구조(H2·FAQ)는 네이버와 동일하게 두고, **제목·메타·라벨**만 Google에 맞게 조정합니다.

- **발행 순서:** 네이버 블로그 선발행 → 동일 본문을 Blogger에 복사 (또는 가이드 초안을 양쪽에 각각 메타만 조정)
- **제목:** 핵심 키워드를 앞 40자 안에 · 과도한 이모지·특수문자 지양 (Google SERP 가독성)
- **메타 설명(Search description):** 140~160자 · 첫 문장에 키워드 1개 · «이 글에서 얻는 것» 한 줄
- **라벨(Labels):** 3~5개 · 주제·세부 키워드·시한성(2026 등) 혼합
- **대표 이미지:** 1200px 너비 권장 · **alt 텍스트**에 키워드 자연 포함 (이미지 검색·접근성)
- **본문:** H2 4~6개 유지 · 첫 단락 150자 안에 결론 요약 (Featured snippet 대비)
- **내부 링크:** 관련 글 1~2개 · 외부 링크는 신뢰 출처만
- **AdSense:** 본문 1,000자 이상 권장 · 제목·H2 사이 광고 과밀 배치 금지 · «클릭 유도» 문구 본문에 넣지 않음
- **영문 확장(선택):** 동일 주제 «영문 제목 1줄 + 영문 요약 2문장»을 글 맨 아래 별도 블록으로 — 글로벌 검색 실험용
- **중복 콘텐츠:** 네이버와 문장 100% 동일해도 무방하나, **제목·메타·첫 단락**은 플랫폼별로 살짝 다르게 (검색 스니펫 차별화)

### 본문 구조 템플릿

- 도입(10%): 문제 제기 + «이 글에서 얻는 것» 1문장
- 본론(75%): H2별 «주장 1줄 → 근거·사례 → 실천 팁»
- 결론(15%): 3줄 요약 + CTA + (선택) FAQ 2~3개
- FAQ: «○○란?» «언제 해야 하나?» — 검색 롱테일 대응

### SNS 카피 (캡션·카드뉴스)

- 1문장 후킹(질문·숫자·반전) → 2~3문장 가치 → CTA
- 해시태그: 플랫폼 규칙에 맞게 3~7개
- 카드뉴스: 1장=1메시지, 마지막 장에 저장·공유 유도

### 마무리 팁

참고 레퍼런스에서 vs.Avg가 높은 글 3개의 «제목 구조»와 «첫 H2 소제목»만 추출해 표로 정리한 뒤, 내 주제에 맞게 치환합니다. 문장 전체 복사는 피합니다.

---

<!-- agent:blog-image -->

## 블로그 환기용 이미지·표 가이드 (fullContent에 삽입)

- 본문 중간에 **환기용 이미지 가이드 {{imageGuideCount}}개** 내외의 **텍스트 블록**을 삽입합니다 (실제 이미지 파일 생성 금지).
- 1~2곳은 **표 가이드**로 대체 가능 (비교·체크리스트·숫자 요약).
- 가이드는 H2 섹션 사이·긴 문단 묶음 직후 등 읽기 흐름이 답답해지기 전에 배치합니다.

### 이미지 가이드 블록 형식 (그대로 사용)

> **📷 [환기용 이미지 가이드 N/M — 직접 제작·삽입]**
> - **삽입 위치:** (어느 H2·문단 직후인지)
> - **이미지 유형:** (일러스트 / 인포그래픽 / 스크린샷 / 다이어그램 / 표 등)
> - **화면 구성:** (주요 오브젝트·색감·텍스트 오버레이)
> - **전달 메시지:** (이 구간 독자가 얻어야 할 한 줄)
> - **캡션 예시:** (20자 내외)

### 표 가이드 예시

> **📊 [표 가이드 — 직접 제작·삽입]**
> - **삽입 위치:** ...
> - **표 제목:** ...
> - **열 구성:** ...
> - **행 예시:** ...

---

<!-- agent:platform-shortform-spec -->

## 플랫폼 스펙 (요약 — 상세는 platform_shortform_specs.md)

숏폼 작성 전 **반드시** `guidelines/platform_shortform_specs.md` 규칙을 따릅니다.  
출처: https://branderkey.notion.site/33c835c9591a8008b0cef37fcf50043f

- 9:16 · 1080×1920 · 통합 안전영역 중앙 1080×1300
- Shorts 15~60초 · Reels 15~90초 · TikTok 21~34초(세로) 참고
- Flow 프롬프트: vertical 9:16, center safe zone, no text bottom 20% / right 180px

---

<!-- agent:shortform -->

## 숏폼 공통 가이드 (video / shortform)

### 방향

롱폼은 구조·신뢰, 숏폼은 **첫 1초 훅**이 전부입니다. 트렌드 주제라면 «왜 지금인가»를 도입 **0~5초** 안에 말합니다.

### 체크리스트 (Agent가 스크립트에 반영)

- 0~3초: 질문 또는 결과 미리보기(숫자/반전) — 아래 «바이럴 제목·썸네일»에서 던진 떡밥을 바로 회수
- 본론 전 «이 영상에서 얻는 것» 한 문장 예고
- 텍스트 훅(숏)으로 이탈 구간 막기
- 엔딩: 구독·다음 영상 예고 + 동일 키워드 자막 반복
- 루프 가능한 구조(마지막이 첫 장면과 연결) 실험
- 자막은 키워드만 굵게, 한 줄 길이 짧게

### 바이럴 제목·썸네일 설계 (스크립트보다 먼저 확정 — 클릭률을 좌우)

스크립트를 쓰기 전에 제목·썸네일을 먼저 설계합니다. **둘의 역할 분리와 시너지**가 클릭률(CTR)의 핵심입니다.

- **역할 분리 (텍스트 반복 절대 금지):** 썸네일 = "질문·호기심" 던지기 / 제목 = "해답 힌트·맥락" 제공. 같은 단어를 양쪽에 쓰지 않습니다.
  - 예) 썸네일 텍스트 «왕의 진짜 얼굴» + 제목 «태종 이방원이 밤마다 몰래 했던 행동 3가지»
- **제목 공식 (1~2개 결합, 15~25자):** FOMO(놓치면 손해) · 호기심 갭(다 알려주지 않기) · 홀수 법칙(3·5·7가지) · 뾰족한 타겟팅(예: «직장인 필독»)
- **썸네일 텍스트:** 5~7자 이내 극단적 미니멀. 가독성 치트키 — 노랑 텍스트+검정 테두리 또는 빨강 배경+흰색 텍스트. 감정(놀람·반전·분노)이 담긴 «하이라이트 프레임» 1장만 사용
- **떡밥 회수:** 영상 시작 **0~3초 안에** 썸네일이 던진 질문의 단서를 즉시 제시해 이탈을 막습니다.

#### 발행 전 CTR 체크리스트 (fullContent 맨 아래에 포함)

- [ ] 썸네일 텍스트가 5~7자 이내로 한눈에 읽히는가?
- [ ] 썸네일 텍스트와 제목이 서로 반복되지 않고 «질문 ↔ 해답» 시너지를 내는가?
- [ ] 타겟 시청자가 제목을 보고 «어? 내 얘긴데?» 할 수 있는가?
- [ ] 영상 시작 0~3초 안에 썸네일의 떡밥을 바로 회수하는가?

### 영상·이미지 생성 (필수 전제)

- 숏츠 클립·비주얼은 **Higgsfield가 아님**. **Google AI Pro + [Google Flow](https://flow.google)**(Veo)로 생성합니다.
- Agent는 **Flow에 붙여넣을 영문 프롬프트**를 장면마다 작성합니다. (일상어 한글 설명 + 구체적 영문 생성 지시)
- Flow/Veo 특성: **씬당 짧은 클립**(수 초), **9:16 세로**, 시네마틱·프롬프트 준수·(Veo 3) 환경음·대사 가능
- **Ingredients to video**: 동일 캐릭터·오브젝트 유지가 필요하면 프롬프트에 외형·의상·색을 반복 명시
- 크레딧 절약: **씬 3~5개**, 재생성 최소 · Fast/Lite vs Quality는 제작 메모에 표기

### 플랫폼 (업로드)

- YouTube Shorts / Reels / TikTok
- 세로 **9:16**, **60초 이내** (Flow 클립 여러 개 → 캡컷 등에서 이어 붙임)
- 첫 **1~2초 훅** · 루프 가능 엔딩 · 짧은 자막(onScreenText) 필수

### 숏폼 장면 스크립트 (fullContent 필수)

- **45~60초** 기준, **3~5개 장면**으로 분할합니다.
- 레퍼런스 흔적 제거·발행용 톤 유지, 본문은 **시간대별 장면 블록**이 핵심입니다.

#### flowPasteBlock (씬별 — Flow에 **한 번에 복사**하는 유일한 위치)

씬마다 아래 형식. 영문은 **한 덩어리**로만 (9:16·안전영역·비주얼·카메라를 중복 문장 없이 통합).

```
### 씬1 · 0~5초 · 첫 훅

Vertical 9:16 cinematic close-up, hands offering water and medicine beside a bed, sick person resting, warm window light, shallow depth of field, worried caring mood, slow push-in. Subject centered in 1080×1300 safe zone, no on-screen text or UI.

---

### 씬2 · 6~14초 · 헌신
(다음 씬 영문 한 덩어리)
```

#### fullContent 장면 블록 (Flow 줄 **금지** — 상단 flowPasteBlock과 중복 금지)

```
[0~5초] 장면1 · 첫 훅) 여친이 아파서 오늘 하루 온전히 돌봐주기로 했어요.
**화면(한글):** 침대 옆에서 물·약 챙기는 손 클로즈업, 걱정스러운 표정

[6~14초] 장면2 · 헌신) ...
```

#### JSON 출력 (숏폼 필수 필드)

- **flowPasteBlock**: 씬별 `### 씬N · 시간 · 제목` + 영문 한 덩어리 (`---`로 씬 구분). 사용자가 **씬마다 블록 전체**를 Flow에 붙여넣음
- **fullContent**: 시간·나레이션·화면(한글)·자막·제작 메모만 (**Google Flow:** 줄 없음)

#### fullContent 맨 아래 필수 섹션

## 📱 자막 오버레이
- (장면별 핵심 자막 1줄씩, 4~6개)

## 🎬 Google Flow 제작 메모
- 도구: Google Flow (Gemini Pro / Veo) · 세로 9:16
- 총 N씬 · 씬당 Flow 1생성 권장 (크레딧 절약)
- (선택) Veo Fast / Quality · Ingredients·캐릭터 일관성 메모 1줄
- 편집: 생성 클립을 시간순 concat → Shorts 업로드

#### 규칙

- 시간대는 **0초부터 연속**, 겹치지 않게, 합계 **60초 이내**
- 장면 제목은 **한글**로 «무슨 장면인지» 바로 알 수 있게
- Flow용 영문은 **flowPasteBlock에만** · 구체적 비주얼 (추상적 «예쁜 영상» 금지). Higgsfield·Midjourney 등 다른 툴 이름 금지

### 마무리 팁

벤치마킹으로 등록한 고성과 영상 3개의 **도입부 문장 구조**만 참고한 뒤, 자신의 정보로 치환합니다.

---

<!-- agent:shortform-categories -->

## 숏폼 카테고리 (UI 선택 id와 동일하게 유지)

아래 `category-id`는 대시보드 «숏폼 카테고리» 드롭다운과 맞춰야 합니다.  
카테고리를 추가할 때는 UI용 `shortform-categories.ts` 커스텀 추가와 함께 이 섹션에도 블록을 복사해 넣으세요.

### category-id: animal-live-story

- **label:** 동물 숏츠 · 실사 스토리형
- **description:** 실사 영상·내레이션·감정선이 있는 동물 에피소드. 1마리=1스토리, 반전·구원·우정 등 짧은 드라마 구조.
- **flow_hint:** Veo vertical, photoreal animal, natural light, close-up, emotional beat on last 2 seconds

### category-id: animal-3d-dance-comic

- **label:** 동물 숏츠 · 3D / 댄스 / 코믹형
- **description:** 3D·댄스·밈·과장 코믹. 루프·비트에 맞춘 동작, 귀여움·웃음·충격 컷.
- **flow_hint:** Stylized 3D character motion, dance beat sync, bright colors, fast cuts, loop-friendly ending

### category-id: story-nate-blind

- **label:** 썰 숏츠 · 네이트 판 / 블라인드 스토리형
- **description:** 익명·판형·블라인드 톤. 1인칭 썰, 댓글 반응형·반전 엔딩, 자막이 스토리 전달의 핵심.
- **flow_hint:** Blurred B-roll background, subtitle-safe framing, minimal motion, narration-friendly pacing

### category-id: comedy-short-happening

- **label:** 개그 숏츠 · 해프닝 / 상황극형
- **description:** 돕거나 일상하다 **웃긴 사고·오해·반전**이 터지는 코믹. 감동보다 **해프닝·밈·리액션**이 클릭 이유.
- **flow_hint:** Exaggerated expressions, slapstick timing, quick punchline cut, comedic loop end

### category-id: empathy-character-drama

- **label:** 공감 숏츠 · 캐릭터 드라마형
- **description:** 고정 캐릭터·일상·연애·직장 공감 드라마. 짧은 대사·표정·상황극.
- **flow_hint:** Same character look across scenes (describe outfit/hair), indoor daily life, emotional close-up

### category-id: quote-motivation-cinematic

- **label:** 명언/동기부여 숏츠 · 시네마틱 배경형
- **description:** 명언·동기부여·자기계발. 시네마틱 B-roll + 굵은 자막 + 잔잔한 BGM.
- **flow_hint:** Cinematic landscape B-roll, slow motion, golden hour, space for bold typography overlay

### category-id: asmr-sound-focus

- **label:** ASMR 숏츠 · 소리에 집중하는 영상형
- **description:** 타격음·먹방·자연음·속삭임. 화면보다 소리·리듬·근접 마이크감이 핵심.
- **flow_hint:** Macro texture shots, hands and food close-up, minimal camera move, Veo ambient sound emphasis

### category-id: interview-drama-bts

- **label:** 인터뷰 숏츠 · 드라마/영화 비하인드형
- **description:** 가상 인터뷰·비하인드·패러디. 무비클립 톤·자막 Q&A·드라마틱 조명.
- **flow_hint:** Interview framing, shallow depth of field, blurred backdrop, film grain, lower-third safe area
