import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'

export interface SuggestedReferenceSite {
  url: string
  title: string
  siteName: string
  reason: string
}

export function buildReferenceSuggestSitesPrompt(publishTopic: string, category?: GuideCategory): string {
  const categoryHint =
    category === 'video'
      ? '영상·롱폼 콘텐츠'
      : category === 'image'
        ? '카드뉴스·이미지 콘텐츠'
        : '블로그·글쓰기'

  return `당신은 콘텐츠 리서치 어시스턴트입니다.
발행 주제와 관련해 **대표·권위 있는 참고 페이지** URL을 추천해 주세요.

## 발행 주제
${publishTopic.trim()}

## 콘텐츠 유형
${categoryHint}

## 추천 기준
- YouTube·블로그뿐 아니라 **공식 홈페이지, 위키, 커뮤니티 대표 페이지, 게임 DB·가이드 사이트**(예: Wowhead, Fextralife, 공식 포럼) 등 **주제의 대표격 페이지**를 우선합니다.
- 실제로 존재하는 공개 URL만 (로그인 필수·404 가능성 높은 URL 금지).
- 한국어·영어 모두 가능. 주제에 맞는 언어를 선택하세요.
- **3~6개**, 서로 다른 사이트·관점이면 좋습니다.
- 각 항목에 «왜 이 페이지가 참고 가치가 있는지» 한 줄 이유를 적으세요.

## 출력 (JSON만, 다른 텍스트 없이)
{
  "sites": [
    {
      "url": "https://...",
      "title": "페이지 또는 글 제목 (추정 가능)",
      "siteName": "사이트명 (예: Wowhead, 나무위키)",
      "reason": "참고 가치 한 줄"
    }
  ]
}`
}

export function parseReferenceSuggestSitesResponse(text: string): SuggestedReferenceSite[] {
  if (!text.trim()) return []
  try {
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fence ? fence[1].trim() : text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
    const parsed = JSON.parse(fixed) as { sites?: SuggestedReferenceSite[] }
    if (!Array.isArray(parsed.sites)) return []
    return parsed.sites
      .filter((s) => s?.url?.trim())
      .map((s) => ({
        url: String(s.url).trim(),
        title: String(s.title ?? s.url).trim(),
        siteName: String(s.siteName ?? '').trim() || 'Web',
        reason: String(s.reason ?? '').trim(),
      }))
      .slice(0, 8)
  } catch {
    return []
  }
}
