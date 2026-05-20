/**
 * 콘텐츠 가이드 화면용 정적 가이드 — 트렌드·Outlier 레퍼런스는 뷰에서 API로 보강합니다.
 *
 * 추후 AI 스크립트 가이드 연동 시:
 * - `GUIDE_BY_CATEGORY`는 시스템 프롬프트·룰 또는 후처리 체크리스트로 재사용.
 * - `buildAiScriptGuidePayload`로 컨텍스트를 조립해 `/api/...` 또는 n8n 웹훅으로 전송.
 * - 응답은 도입 훅 → 챕터 불릿 → CTA → 자막용 짧은 문장 등 구조화 JSON 권장.
 */

export type GuideCategory = 'writing' | 'image' | 'video'

/** 연동 시 백엔드/LLM에 넘길 수 있는 최소 컨텍스트(필드는 점진적 추가) */
export interface AiScriptGuideRequestContext {
  category: GuideCategory
  /** 화면에서 선택·복사한 키워드 */
  keywords: string[]
  /** Outlier 등 참고 제목 */
  referenceTitles: string[]
  /** 롱폼·숏폼·블로그 등 — 가이드 탭과 매핑 */
  intent: 'longform_video' | 'shortform_video' | 'blog' | 'carousel' | 'general'
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
      '블로그·카드뉴스 카피·게시글은 검색 의도와 체류 시간이 핵심입니다. 트렌드 키워드를 제목 H1/H2에 녹이되, 본문 첫 문단에서 질문에 답하세요.',
    checklist: [
      '검색 키워드 1개를 제목 앞부분에 배치',
      '1·2문단 안에 결론(요약) 제시',
      'H2 소제목 3~5개로 스캔 가능한 구조',
      '표/번호 목록으로 정보 밀도 올리기',
      '마지막에 다음 행동(댓글·구독·링크) 한 줄',
    ],
    sections: [
      {
        heading: '네이버 블로그 / 티스토리',
        bullets: [
          '썸네일용 한 줄 훅 + 본문 첫 이미지는 텍스트와 같은 메시지',
          '검색 노출: 키워드 반복보다 동의어·관련어 자연 배치',
        ],
      },
      {
        heading: 'SNS 카피 (캡션)',
        bullets: [
          '1문장 후킹 → 2~3문장 가치 → 해시태그는 플랫폼 규칙에 맞게 소수 정예',
        ],
      },
    ],
    closingTip: '대시보드의 Outlier 영상 제목 패턴(숫자, 대비, 시한성)을 블로그 제목에도 그대로 실험해 보세요.',
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
