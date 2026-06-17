import {
  buildShortformCategoryPromptBlock,
  buildTopicGuideAngleRules,
  findShortformCategory,
} from '@/lib/dashboard/shortform-categories'
import { buildEmotionToneAngleBlock, type EmotionToneId } from '@/lib/dashboard/emotion-tones'

export interface TopicKeywordGuideSuggestion {
  id: string
  /** 발행 주제 필드에 매핑되는 제목 */
  title: string
  /** 왜 흥미로운지 한 줄 */
  hook: string
  /** 콘텐츠 각도·관련 정보 요약 */
  angle?: string
}

export interface TopicKeywordGuideResult {
  seedKeyword: string
  suggestions: TopicKeywordGuideSuggestion[]
  generatedAt: string
}

export function buildTopicKeywordGuidePrompt(
  seedKeyword: string,
  category?: string,
  shortformCategoryId?: string,
  videoMode?: 'shortform' | 'longform',
  emotionTone?: EmotionToneId,
): string {
  const isLongformVideo = category === 'video' && videoMode === 'longform'
  const isShortformVideo = category === 'video' && videoMode !== 'longform'
  const isVideo = isLongformVideo || isShortformVideo
  const emotionBlock = isVideo ? buildEmotionToneAngleBlock(emotionTone) : ''
  const hasEmotionTone = emotionBlock.length > 0

  let categoryHint = ''
  if (category === 'writing') categoryHint = '\n선택 포맷 힌트: 블로그·글쓰기'
  else if (category === 'image') categoryHint = '\n선택 포맷 힌트: 인스타 캐러셀·이미지'
  else if (isLongformVideo) {
    categoryHint = '\n선택 포맷 힌트: YouTube 롱폼 영상 (8~12분, 챕터 구성 내레이션)'
  } else if (isShortformVideo) {
    const cat = findShortformCategory(shortformCategoryId)
    categoryHint = '\n선택 포맷 힌트: YouTube Shorts·Reels·TikTok 숏폼 (60초 이내)'
    categoryHint += buildShortformCategoryPromptBlock(shortformCategoryId)
    categoryHint += buildTopicGuideAngleRules(shortformCategoryId)
    if (!cat) {
      categoryHint +=
        '\n⚠️ 숏폼 카테고리가 없으면 angle을 일반 숏폼으로만 작성.'
    }
  }
  categoryHint += emotionBlock

  const toneSuffix = hasEmotionTone
    ? ' 그리고 위 «추구하는 감정 톤»에 맞는 전개·결말만 — 카테고리 장르와 감정 톤을 모두 만족해야 함 (둘 중 하나라도 어긋나면 안 됨).'
    : ''

  const angleRule = isShortformVideo
    ? `5. **angle (필수)**: 위 «숏폼 카테고리» 장르에 맞는 **스토리 전개·톤·엔딩**만 80~150자. 다른 장르(예: 썰↔개그) 톤 혼용 금지.${toneSuffix}`
    : isLongformVideo
      ? `5. **angle (필수)**: 8~12분 롱폼 영상으로 풀어낼 **챕터 구성·전개 방향**만 80~150자 (숏폼 톤 언급 금지).${toneSuffix}`
      : '5. angle은 다룰 핵심 정보·스토리 포인트 (선택, 60자 내외).'

  const roleIntro = isShortformVideo
    ? '당신은 숏폼·콘텐츠 기획 에디터입니다. 사용자가 «주제 가이드 키워드»를 입력했습니다. 이 키워드와 관련된 **발행 주제 후보**를 제안하세요. 제안마다 **선택된 숏폼 카테고리 장르**에 맞게 angle을 반드시 다르게 쓰세요.'
    : isLongformVideo
      ? '당신은 YouTube 롱폼 콘텐츠 기획 에디터입니다. 사용자가 «주제 가이드 키워드»를 입력했습니다. 이 키워드와 관련된 **8~12분 롱폼 영상 발행 주제 후보**를 제안하세요. 제안마다 angle은 챕터 전개·관점이 서로 다르게 작성하세요.'
      : '당신은 콘텐츠 기획 에디터입니다. 사용자가 «주제 가이드 키워드»를 입력했습니다. 이 키워드와 관련된 **발행 주제 후보**를 제안하세요.'

  return `${roleIntro}
${categoryHint}

## 입력 키워드
${seedKeyword.trim()}

## 규칙
1. **3~10개** 제안 (키워드가 좁으면 3~5개, 넓으면 최대 10개).
2. title: 발행 주제 문장 (15~60자). 같은 뜻 반복 금지 — **전개·관점·결말 유형**을 바꿀 것.
3. hook: 클릭/관심 이유 1문장 (40자 내외).
4. title만 바꾸고 angle이 비슷한 제안 금지.
${angleRule}

반드시 JSON만 응답:
{
  "suggestions": [
    {
      "id": "1",
      "title": "발행 주제로 쓸 구체적 제목·키워드",
      "hook": "흥미 포인트 한 줄",
      "angle": "${
        isShortformVideo
          ? '이 숏폼 카테고리로 풀 스토리 전개·톤·엔딩 (80~150자)'
          : isLongformVideo
            ? '8~12분 롱폼으로 풀 챕터 구성·전개 방향 (80~150자)'
            : '다룰 핵심 정보·스토리 포인트 (선택, 60자 내외)'
      }"
    }
  ]
}`
}

export function parseTopicKeywordGuideResponse(
  text: string,
  seedKeyword: string,
): TopicKeywordGuideResult | null {
  if (!text.trim()) return null
  try {
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fence ? fence[1].trim() : text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
    const parsed = JSON.parse(fixed) as {
      suggestions?: {
        id?: string
        title?: string
        hook?: string
        angle?: string
      }[]
    }
    const suggestions = (parsed.suggestions ?? [])
      .map((s, i) => ({
        id: String(s.id ?? i + 1),
        title: String(s.title ?? '').trim(),
        hook: String(s.hook ?? '').trim(),
        angle: s.angle ? String(s.angle).trim() : undefined,
      }))
      .filter((s) => s.title.length >= 4)
      .slice(0, 10)

    if (suggestions.length === 0) return null

    return {
      seedKeyword: seedKeyword.trim(),
      suggestions,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
