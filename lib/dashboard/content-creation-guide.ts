/**
 * 콘텐츠 가이드 화면용 정적 가이드 — 트렌드·사용자 선택 레퍼런스는 뷰에서 API/localStorage로 보강합니다.
 *
 * Agent 가이드라인(블로그·숏폼): `guidelines/contents_guideline.md` (편집 후 저장만 하면 반영).
 * `GUIDE_BY_CATEGORY`는 화면 체크리스트용 — Agent와 동기화하려면 MD와 맞춰 주세요.
 * - 응답은 도입 훅 → 챕터 불릿 → CTA → 자막용 짧은 문장 등 구조화 JSON 권장.
 */

export type GuideCategory = 'writing' | 'image' | 'video'

export type { AiScriptGuideReference, GuideReferenceMode } from '@/lib/dashboard/guide-reference-modes'
import type { AiScriptGuideReference } from '@/lib/dashboard/guide-reference-modes'
import type { EmotionToneId } from '@/lib/dashboard/emotion-tones'

export interface AiScriptGuideRequestContext {
  category: GuideCategory
  /** 숏폼 제작 카테고리 (영상·숏폼 생성 시) */
  shortformCategoryId?: string
  /** 추구하는 감정 톤 — 카테고리와 별개로 영상(숏폼·롱폼)에서 지정 (예: 동물 숏츠 + 감동) */
  emotionTone?: EmotionToneId
  /** 사용자가 직접 입력한 발행 주제 (최우선) */
  userTopic?: string
  /** 발행 주제에서 파싱한 키워드 */
  keywords: string[]
  /** 참고 제목 (하위 호환) */
  referenceTitles: string[]
  /** 사용자가 직접 선택한 레퍼런스 상세 (선택) */
  references?: AiScriptGuideReference[]
  /** 롱폼·숏폼·블로그 등 — 가이드 탭과 매핑 */
  intent: 'longform_video' | 'shortform_video' | 'blog' | 'carousel' | 'general'
  /** Gemini 모델 ID (예: gemini-2.5-flash) */
  aiModel?: string
}

export interface GuideSection {
  heading: string
  bullets: string[]
}

export interface CategoryGuide {
  title: string
  intro: string
  checklist: string[]
  sections: GuideSection[]
  closingTip: string
}

export const GUIDE_BY_CATEGORY: Record<GuideCategory, CategoryGuide> = {
  writing: {
    title: '글쓰기',
    intro:
      '블로그·카드뉴스·게시글은 «검색 의도에 답하는 제목»과 «스캔 가능한 본문 구조»가 핵심입니다. 참고 레퍼런스의 제목·소제목 패턴만 구조적으로 벤치마킹하고, 정보는 직접 조사한 사실로 채우세요.',
    checklist: [
      '핵심 키워드 1개를 제목 앞 15자 안에 배치',
      '첫 2문단 안에 결론·핵심 수치(요약) 제시 — «결론부터»',
      'H2 소제목 3~6개, 각 소제목 아래 3~5문장 또는 번호 목록',
      '표·비교표·체크리스트로 정보 밀도 올리기 (체류 시간↑)',
      '본문 중간 1곳에 내부 링크 또는 관련 글 언급',
      '마지막 단락: 다음 행동(댓글·구독·저장·공유) 한 줄 CTA',
      '레퍼런스 3개의 제목 패턴(숫자·질문·대비) 중 1개를 내 제목에 적용',
    ],
    sections: [
      {
        heading: '제목 공식 (고성과 패턴)',
        bullets: [
          '숫자형: «2026년 ○○ 5가지» / «월 ○만원 절약하는 방법»',
          '질문형: «왜 지금 ○○일까?» / «○○, 정말 효과 있을까?»',
          '대비형: «○○ vs △△, 뭐가 나을까» / «전문가 vs 초보 차이»',
          '시한성: «올해 말 전에» / «○월부터 바뀌는» — 트렌드 키워드와 결합',
        ],
      },
      {
        heading: '네이버 블로그 / 티스토리',
        bullets: [
          '썸네일·대표 이미지: 제목과 같은 메시지, 텍스트 3~5단어 이내',
          '첫 H2 전 150~200자: 검색 의도에 대한 직접 답변 (AI 요약·스니펫 대비)',
          '키워드 반복보다 동의어·관련어·LSI 키워드 자연 배치',
          '목차(네이버): H2 4개 이상이면 자동 목차 활성화',
          '티스토리: 카테고리·태그 3~5개, 메타 설명 120자 이내',
        ],
      },
      {
        heading: 'Google Blogger (발행 확장)',
        bullets: [
          '네이버 발행본 또는 가이드 초안 → Blogger에 미러 (H2·FAQ 구조 동일)',
          '메타 설명 140~160자 · 라벨 3~5개 · 대표 이미지 alt에 키워드',
          '제목·첫 단락만 Google SERP에 맞게 살짝 조정 (본문은 공유 가능)',
          'AdSense: 1,000자+ · 광고 과밀·클릭 유도 문구 금지',
          '(선택) 글 하단 영문 제목·요약 2문장 — 글로벌 검색 실험',
        ],
      },
      {
        heading: '본문 구조 템플릿',
        bullets: [
          '도입(10%): 문제 제기 + «이 글에서 얻는 것» 1문장',
          '본론(75%): H2별 «주장 1줄 → 근거·사례 → 실천 팁»',
          '결론(15%): 3줄 요약 + CTA + (선택) FAQ 2~3개',
          'FAQ: «○○란?» «언제 해야 하나?» — 검색 롱테일 대응',
        ],
      },
      {
        heading: 'SNS 카피 (캡션·카드뉴스)',
        bullets: [
          '1문장 후킹(질문·숫자·반전) → 2~3문장 가치 → CTA',
          '해시태그: 플랫폼 규칙에 맞게 3~7개, 브랜드·주제·트렌드 혼합',
          '카드뉴스: 1장=1메시지, 마지막 장에 저장·공유 유도',
        ],
      },
    ],
    closingTip:
      '참고 레퍼런스에서 vs.Avg가 높은 글 3개의 «제목 구조»와 «첫 H2 소제목»만 추출해 표로 정리한 뒤, 내 주제에 맞게 치환해 보세요. 문장 전체 복사는 피하세요.',
  },
  image: {
    title: '이미지',
    intro:
      '캐러셀·썸네일·카드뉴스는 “한 장에 한 메시지”입니다. 레퍼런스가 강한 카테고리일수록 타이포 대비와 여백이 클릭을 좌우합니다.',
    checklist: [
      '1슬라이드 = 1핵심 문장 (보조 설명은 최대 2줄)',
      '브랜드 색·폰트 2종 이내로 통일',
      '모바일 세로 기준 안전 영역(상하단) 확보',
      'Before/After, 숫자, 질문형 레이아웃 중 하나 선택',
    ],
    sections: [
      {
        heading: '인스타 캐러셀',
        bullets: [
          '1장: 문제 제기 · 중간: 원인/팁 · 마지막: 요약+CTA',
          '텍스트 많은 슬라이드는 배경 단색·고대비',
        ],
      },
      {
        heading: '썸네일 (영상 연계)',
        bullets: [
          '얼굴·감정 표정 + 큰 숫자/키워드 3단어 이내',
          '롱폼은 정보 밀도, 숏폼은 호기심 갭 강조',
        ],
      },
    ],
    closingTip: '급상승 키워드를 이미지 첫 장의 큰 텍스트로 쓰면 시리즈 통일감이 생깁니다.',
  },
  video: {
    title: '영상',
    intro:
      '롱폼은 구조·신뢰, 숏폼은 첫 1초 훅이 전부입니다. 트렌드 주제라면 “왜 지금인가”를 도입 0~5초 안에 말하세요.',
    checklist: [
      '0~3초: 질문 또는 결과 미리보기(숫자/반전)',
      '본론 전 “이 영상에서 얻는 것” 한 문장 예고',
      '챕터(롱폼) 또는 텍스트 훅(숏)으로 이탈 구간 막기',
      '엔딩: 구독·다음 영상 예고 + 동일 키워드 자막 반복',
    ],
    sections: [
      {
        heading: '롱폼 (10분±)',
        bullets: [
          '서론 10% · 본론 75% · 결론+CTA 15% 느낌으로 편집',
          '그래프·자료 화면은 7초 이상 머무르지 않게 컷 전환',
        ],
      },
      {
        heading: '숏폼 / 릴스',
        bullets: [
          '루프 가능한 구조(마지막이 첫 장면과 연결) 실험',
          '자막은 키워드만 굵게, 한 줄 길이 짧게',
        ],
      },
    ],
    closingTip: '벤치마킹으로 등록한 고성과 영상 3개의 도입부만 베껴 쓰기(문장 구조) 후 자신의 정보로 치환해 보세요.',
  },
}

/** 프론트에서 요청 페이로드 조립 — 실제 `fetch`는 API 경로 확정 후 연결 */
export function buildAiScriptGuidePayload(ctx: AiScriptGuideRequestContext): Record<string, unknown> {
  const g = GUIDE_BY_CATEGORY[ctx.category]
  return {
    type: 'script_guide_v1',
    context: ctx,
    staticRules: {
      checklistByCategory: g.checklist,
      closingTip: g.closingTip,
    },
    requestedOutputs: [
      'hook_opening_3variants',
      'chapter_bullets',
      'cta_line',
      'subtitle_short_lines',
      'tone_and_taboo_hints',
    ],
  }
}

/** API 실패 시 레퍼런스 카드용 폴백 */
export const FALLBACK_REFERENCE_TITLES: { title: string; platform: string; hint: string }[] = [
  { title: '금리 인상 시대의 재테크 전략', platform: 'youtube', hint: '숫자+시의성 훅' },
  { title: '부동산 투자 완벽 가이드', platform: 'naver-blog', hint: '장문 H2 구조 참고' },
  { title: '주식 전망 카드뉴스 시리즈', platform: 'instagram', hint: '캐러셀 5장 흐름' },
]
