/**
 * 영상(숏폼·롱폼) 기획 시 "추구하는 감정" — 콘텐츠 카테고리(예: 동물 숏츠)와는 별개로,
 * 같은 카테고리 안에서도 감동/개그/분노 등 서로 다른 톤이 나올 수 있어 사용자가 직접 지정합니다.
 */

export type EmotionToneId =
  | 'none'
  | 'touching'
  | 'comedy'
  | 'catharsis'
  | 'sad'
  | 'thrill'
  | 'healing'

export interface EmotionTone {
  id: EmotionToneId
  label: string
  icon: string
  /** 선택 UI에 보여줄 짧은 설명 */
  description: string
  /** 주제 가이드 angle 작성 시 반영할 톤 규칙 */
  angleHint: string
  /** 실제 대본·스크립트 작성 시 반영할 톤 규칙 */
  scriptHint: string
}

export const EMOTION_TONES: EmotionTone[] = [
  {
    id: 'none',
    label: '자유 (지정 안 함)',
    icon: '🙂',
    description: '카테고리 기본 톤에 맡깁니다.',
    angleHint: '',
    scriptHint: '',
  },
  {
    id: 'touching',
    label: '감동·뭉클함',
    icon: '🥹',
    description: '뭉클한 여운, 헌신·구원·재회 같은 따뜻한 울림',
    angleHint:
      '**감동·뭉클함**이 핵심 — 헌신·구원·재회·성장처럼 마음이 따뜻해지는 전개와 여운 있는 엔딩만 쓸 것. 웃음·분노·반전 충격 위주 전개 금지.',
    scriptHint:
      '시청자가 마음이 뭉클해지고 따뜻한 여운을 느끼도록 — 잔잔한 디테일과 진심이 드러나는 장면·문장으로 감정선을 천천히 쌓고, 마지막에 여운을 남기는 톤으로 작성하세요. 과장된 개그·분노 유발 표현은 피하세요.',
  },
  {
    id: 'comedy',
    label: '웃음·개그',
    icon: '😂',
    description: '해프닝·반전 웃음·과장 리액션으로 빵 터지는 톤',
    angleHint:
      '**웃음·개그**가 핵심 — 해프닝·오해·과장된 리액션·예상 밖 반전으로 터지는 코믹 전개만 쓸 것. 감동·진지한 교훈·분노 유발 톤 금지.',
    scriptHint:
      '시청자가 웃음이 터지도록 — 상황의 아이러니·과장된 리액션·예상을 빗나가는 펀치라인을 살려 가볍고 경쾌한 톤으로 작성하세요. 진지하거나 감성적인 설명조는 피하고, 마지막은 웃긴 한 방으로 마무리하세요.',
  },
  {
    id: 'catharsis',
    label: '분노·사이다',
    icon: '😤',
    description: '억울함→통쾌한 반전(사이다)으로 카타르시스를 주는 톤',
    angleHint:
      '**분노·사이다(카타르시스)**가 핵심 — 억울하거나 부당한 상황이 통쾌하게 뒤집히는 전개만 쓸 것 (참다가 한 방에 응징·반전 승리). 잔잔한 감동·가벼운 개그 톤 금지.',
    scriptHint:
      '시청자가 답답함을 느끼다가 후반부에 속이 시원해지도록 — 초반엔 억울하고 부당한 상황을 분명하게 쌓아 긴장감을 만들고, 후반에 통쾌한 반전·응징·승리로 카타르시스를 터뜨리는 구조로 작성하세요. 너무 잔잔하거나 가벼운 톤은 피하세요.',
  },
  {
    id: 'sad',
    label: '슬픔·먹먹함',
    icon: '😢',
    description: '이별·상실 등 마음이 먹먹해지는 여운 있는 톤',
    angleHint:
      '**슬픔·먹먹함**이 핵심 — 이별·상실·그리움처럼 마음이 먹먹해지는 정서를 다루는 전개만 쓸 것. 웃음·통쾌함·밝은 결말 위주 전개 금지.',
    scriptHint:
      '시청자가 마음이 먹먹해지고 여운에 잠기도록 — 담담하고 절제된 문장으로 감정을 직접 설명하기보다 상황과 디테일로 보여주고, 결말에서 차분한 여운을 남기는 톤으로 작성하세요. 과한 개그·밝은 반전은 피하세요.',
  },
  {
    id: 'thrill',
    label: '놀람·반전·스릴',
    icon: '😱',
    description: '예상 밖 전개·긴장감으로 끝까지 보게 만드는 톤',
    angleHint:
      '**놀람·반전·스릴**이 핵심 — 예측 불가능한 전개, 긴장감 있는 고비, 마지막의 충격적 반전을 중심으로 쓸 것. 잔잔한 감동·가벼운 일상 톤 금지.',
    scriptHint:
      '시청자가 다음 장면이 궁금해 끝까지 보게 되도록 — 긴장감을 점층적으로 쌓고, 단서를 흘리며 기대를 비튼 뒤 마지막에 예상 밖 반전으로 마무리하는 톤으로 작성하세요. 결말을 너무 일찍 짐작하게 하는 설명은 피하세요.',
  },
  {
    id: 'healing',
    label: '힐링·잔잔함',
    icon: '😌',
    description: '편안하고 잔잔하게 마음을 쉬게 하는 톤',
    angleHint:
      '**힐링·잔잔함**이 핵심 — 편안하고 느긋한 일상·자연·소소한 행복처럼 마음을 쉬게 하는 전개만 쓸 것. 자극적 반전·분노·과장된 개그 금지.',
    scriptHint:
      '시청자가 편안하게 쉬어가는 느낌을 받도록 — 잔잔하고 부드러운 어조로 소소한 순간·여유로운 분위기를 그리고, 자극적인 전개나 큰 기복 없이 차분하게 마무리하는 톤으로 작성하세요.',
  },
]

const SELECTED_STORAGE_KEY = 'dashboard_guide_emotion_tone_id'

export function findEmotionTone(id: string | undefined): EmotionTone | undefined {
  if (!id) return undefined
  return EMOTION_TONES.find((t) => t.id === id)
}

export function loadSelectedEmotionToneId(): EmotionToneId {
  if (typeof window === 'undefined') return 'none'
  const raw = localStorage.getItem(SELECTED_STORAGE_KEY)
  return findEmotionTone(raw ?? undefined)?.id ?? 'none'
}

export function saveSelectedEmotionToneId(id: EmotionToneId): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SELECTED_STORAGE_KEY, id)
}

/** 주제 가이드(angle) 프롬프트에 추가할 감정 톤 규칙 블록 */
export function buildEmotionToneAngleBlock(id: EmotionToneId | undefined): string {
  const tone = findEmotionTone(id)
  if (!tone || tone.id === 'none' || !tone.angleHint) return ''
  return `\n## 추구하는 감정 톤 (최우선 · 필수)\n선택 톤: **${tone.icon} ${tone.label}**\n${tone.angleHint}\n`
}

/** 발행용 대본 프롬프트에 추가할 감정 톤 규칙 블록 */
export function buildEmotionToneScriptBlock(id: EmotionToneId | undefined): string {
  const tone = findEmotionTone(id)
  if (!tone || tone.id === 'none' || !tone.scriptHint) return ''
  return `\n## 추구하는 감정 톤 (최우선 · 필수)\n선택 톤: ${tone.icon} ${tone.label} — ${tone.description}\n${tone.scriptHint}\n`
}
