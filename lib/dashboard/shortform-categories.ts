/**
 * 숏폼 제작 카테고리 — Google Flow·Shorts/Reels 기획용
 * Agent 상세 규칙: guidelines/contents_guideline.md
 */

export interface ShortformCategory {
  id: string
  label: string
  /** AI 프롬프트·체크리스트용 설명 */
  description: string
  /** Google Flow(Veo) 프롬프트 힌트 */
  flowHint: string
  /** @deprecated 하위 호환 — flowHint 사용 */
  higgsfieldHint?: string
  /** 내장(builtin) vs 사용자 추가 */
  source: 'builtin' | 'custom'
}

function normalizeCategory(c: ShortformCategory): ShortformCategory {
  const flowHint = c.flowHint?.trim() || c.higgsfieldHint?.trim() || ''
  const { higgsfieldHint: _legacy, ...rest } = c
  return { ...rest, flowHint }
}

export const BUILTIN_SHORTFORM_CATEGORIES: ShortformCategory[] = [
  {
    id: 'animal-live-story',
    label: '동물 숏츠 · 실사 스토리형',
    description:
      '실사 영상·내레이션·감정선이 있는 동물 에피소드. 1마리=1스토리, 반전·구원·우정 등 짧은 드라마 구조.',
    flowHint: 'Veo vertical, photoreal animal, natural light, close-up, emotional beat on last 2 seconds',
    source: 'builtin',
  },
  {
    id: 'animal-3d-dance-comic',
    label: '동물 숏츠 · 3D / 댄스 / 코믹형',
    description:
      '3D·댄스·밈·과장 코믹. 루프·비트에 맞춘 동작, 귀여움·웃음·충격 컷.',
    flowHint: 'Stylized 3D character motion, dance beat sync, bright colors, fast cuts, loop-friendly ending',
    source: 'builtin',
  },
  {
    id: 'story-nate-blind',
    label: '썰 숏츠 · 네이트 판 / 블라인드 스토리형',
    description:
      '익명·판형·블라인드 톤. 1인칭 썰, 댓글 반응형·반전 엔딩, 자막이 스토리 전달의 핵심.',
    flowHint: 'Blurred B-roll background, subtitle-safe framing, minimal motion, narration-friendly pacing',
    source: 'builtin',
  },
  {
    id: 'comedy-short-happening',
    label: '개그 숏츠 · 해프닝 / 상황극형',
    description:
      '돕거나 일상하다 **웃긴 사고·오해·반전**이 터지는 코믹. 감동보다 **해프닝·밈·리액션**이 클릭 이유.',
    flowHint: 'Exaggerated expressions, slapstick timing, quick punchline cut, comedic loop end',
    source: 'builtin',
  },
  {
    id: 'empathy-character-drama',
    label: '공감 숏츠 · 캐릭터 드라마형',
    description:
      '고정 캐릭터·일상·연애·직장 공감 드라마. 짧은 대사·표정·상황극.',
    flowHint: 'Same character look across scenes (describe outfit/hair), indoor daily life, emotional close-up',
    source: 'builtin',
  },
  {
    id: 'quote-motivation-cinematic',
    label: '명언/동기부여 숏츠 · 시네마틱 배경형',
    description:
      '명언·동기부여·자기계발. 시네마틱 B-roll + 굵은 자막 + 잔잔한 BGM.',
    flowHint: 'Cinematic landscape B-roll, slow motion, golden hour, space for bold typography overlay',
    source: 'builtin',
  },
  {
    id: 'asmr-sound-focus',
    label: 'ASMR 숏츠 · 소리에 집중하는 영상형',
    description:
      '타격음·먹방·자연음·속삭임. 화면보다 소리·리듬·근접 마이크감이 핵심.',
    flowHint: 'Macro texture shots, hands and food close-up, minimal camera move, Veo ambient sound emphasis',
    source: 'builtin',
  },
  {
    id: 'interview-drama-bts',
    label: '인터뷰 숏츠 · 드라마/영화 비하인드형',
    description:
      '가상 인터뷰·비하인드·패러디. 무비클립 톤·자막 Q&A·드라마틱 조명.',
    flowHint: 'Interview framing, shallow depth of field, blurred backdrop, film grain, lower-third safe area',
    source: 'builtin',
  },
]

const CUSTOM_STORAGE_KEY = 'dashboard_shortform_custom_categories'
const SELECTED_STORAGE_KEY = 'dashboard_shortform_category_id'

export function loadCustomShortformCategories(): ShortformCategory[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ShortformCategory[]
    return parsed
      .filter((c) => c.id && c.label && c.source === 'custom')
      .map(normalizeCategory)
  } catch {
    return []
  }
}

export function saveCustomShortformCategories(items: ShortformCategory[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(items.map(normalizeCategory)))
}

export function loadSelectedShortformCategoryId(): string {
  if (typeof window === 'undefined') return BUILTIN_SHORTFORM_CATEGORIES[0].id
  return localStorage.getItem(SELECTED_STORAGE_KEY) ?? BUILTIN_SHORTFORM_CATEGORIES[0].id
}

export function saveSelectedShortformCategoryId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SELECTED_STORAGE_KEY, id)
}

export function getAllShortformCategories(): ShortformCategory[] {
  return [...BUILTIN_SHORTFORM_CATEGORIES, ...loadCustomShortformCategories()]
}

export function findShortformCategory(id: string | undefined): ShortformCategory | undefined {
  if (!id) return undefined
  return getAllShortformCategories().find((c) => c.id === id)
}

export function slugifyCustomCategoryId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .slice(0, 40)
  return `custom-${base || 'category'}-${Date.now().toString(36)}`
}

/** 주제 키워드 가이드 — 카테고리별 angle(스토리 전개) 작성 규칙 */
export function buildTopicGuideAngleRules(categoryId: string | undefined): string {
  const cat = findShortformCategory(categoryId)
  if (!cat) return ''

  const byId: Record<string, { rules: string; example: string }> = {
    'story-nate-blind': {
      rules:
        'angle에는 **1인칭 썰 톤**으로 스토리 전개만 쓸 것. 감동·헌신·반전·댓글 공감·꿀팁(돌봤더니 나아짐) 중 하나를 명시. 해프닝·개그 요소 금지.',
      example:
        '입력 «아픈 여친 헌신» → angle: «바쁜 와중에 지극정성으로 돌봄→여친 눈물 감동·댓글 공감 유도. 블라인드 썰 톤, 마지막 한 줄 반전.»',
    },
    'comedy-short-happening': {
      rules:
        'angle에는 **웃음·해프닝·오해·과장 상황**만 쓸 것. 감동·시청 각오·진지한 꿀팁 톤 금지.',
      example:
        '입력 «아픈 여친 헌신» → angle: «간호하다 죽은 듯 자는 여친 깨우려다 대참사 / 엄청 챙겨줬는데 알고 보니 감기가 아니었음» 같은 **코믹 반전**.',
    },
    'empathy-character-drama': {
      rules:
        'angle: 일상·연애·가족 **공감 드라마** — 짧은 대사·표정·「나도 그랬어」 순간.',
      example:
        '«아픈 여친» → «말 못 하는 배려·작은 습관으로 마음 표현, 엔딩에 둘 다 울컥»',
    },
    'animal-live-story': {
      rules: 'angle: 실사 동물 **에피소드** — 구조·감정·반전(구원·우정).',
      example: '«유기견» → 「비 오는 날 만난 눈 맞춤→입양→1년 후」',
    },
    'animal-3d-dance-comic': {
      rules: 'angle: 3D/댄스/밈 **코믹 동물** — 루프·비트·귀여움·충격 컷.',
      example: '«고양이» → 「비트에 맞춰 춤→마지막 밈 포즈 루프」',
    },
    'quote-motivation-cinematic': {
      rules: 'angle: **명언 한 줄** + 시네마틱 B-roll 연상(풍경·도시·실루엣). 스토리보다 분위기.',
      example: '«포기» → 「새벽 산책 영상 + 굵은 자막 명언」',
    },
    'asmr-sound-focus': {
      rules: 'angle: **소리·질감·리듬** 중심. 화면은 손·음식·근접. 스토리는 최소.',
      example: '«비 오는 날» → 「빗소리+찻잔 터치 ASMR, 자막 거의 없음」',
    },
    'interview-drama-bts': {
      rules: 'angle: **가상 인터뷰·비하인드 Q&A** 형식. 드라마/영화 톤.',
      example: '«배우» → 「촬영장 인터뷰 질문3개+속마음 자막」',
    },
  }

  const preset = byId[cat.id]
  const rules = preset?.rules ?? `angle: «${cat.label}» 장르에 맞는 **구체적 전개·톤·엔딩**만 (다른 장르 톤 금지).`
  const example =
    preset?.example ??
    `«${cat.label}»에 맞게 title과 다른 각도의 스토리 전개를 angle에 2~3문장으로.`

  return `
## 주제 가이드 — 숏폼 카테고리별 angle (최우선 · 필수)
선택 카테고리: **${cat.label}**
${rules}

**angle 필드 규칙**
- 80~150자, **이 카테고리로만** 풀릴 스토리·전개·엔딩·톤을 구체적으로 (제목 반복 금지).
- hook: 클릭 이유 1문장 (40자 내외).
- title: 발행 주제 문장 (15~60자). 같은 키워드라도 **서로 다른 전개** 3~10개.

참고 예시:
${example}
`
}

/** Gemini 프롬프트에 붙일 숏폼 카테고리 블록 (UI·폴백 — Agent는 contents_guideline.md) */
export function buildShortformCategoryPromptBlock(categoryId: string | undefined): string {
  const cat = findShortformCategory(categoryId)
  if (!cat) return ''

  return `
## 숏폼 카테고리 (필수 반영)
- 유형: ${cat.label}
- 제작 방향: ${cat.description}
- Google Flow(Veo) 프롬프트 힌트: ${cat.flowHint}
- 플랫폼: YouTube Shorts / Reels / TikTok (세로 9:16, 60초 이내)
- 첫 1~2초 훅 · 루프 가능 엔딩 · 짧은 자막(onScreenText) 필수
`
}
