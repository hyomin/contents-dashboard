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

export function buildTopicKeywordGuidePrompt(seedKeyword: string, category?: string): string {
  const categoryHint = category
    ? `\n선택 포맷 힌트: ${category === 'writing' ? '블로그·글쓰기' : category === 'image' ? '인스타 캐러셀·이미지' : '영상·롱폼'}`
    : ''

  return `당신은 콘텐츠 기획 에디터입니다. 사용자가 «주제 가이드 키워드»를 입력했습니다. 이 키워드와 **직접 관련되거나**, 독자에게 **흥미롭게 다룰 수 있는** 발행 주제 예시를 제안하세요.
${categoryHint}

## 입력 키워드
${seedKeyword.trim()}

## 규칙
1. **3~10개** 제안 (키워드가 좁으면 3~5개, 넓으면 최대 10개).
2. 각 제안은 **실제로 발행 가능한 구체적 주제·키워드 문장** (15~60자 내외).
3. 같은 의미 반복 금지. 각도·시각·대상·시점을 다르게.
4. hook은 «왜 클릭/관심을 끌 수 있는지» 1문장 (40자 내외).
5. angle은 다룰 핵심 정보·스토리 포인트 (선택, 60자 내외).

반드시 JSON만 응답:
{
  "suggestions": [
    {
      "id": "1",
      "title": "발행 주제로 쓸 구체적 제목·키워드",
      "hook": "흥미 포인트 한 줄",
      "angle": "다룰 관련 정보·각도"
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
