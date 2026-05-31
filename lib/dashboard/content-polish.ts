import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { GuideReferenceMode } from '@/lib/dashboard/guide-reference-modes'

export interface ContentPolishReference {
  title: string
  referenceMode: GuideReferenceMode
}

export interface ContentPolishRequest {
  title: string
  fullScript: string
  category: GuideCategory
  targetFormat: ContentFormat
  /** 발행 주제 (정재 시 주제 유지) */
  userTopic?: string
  /** 제거·패러프레이즈 대상 레퍼런스 제목 (하위 호환) */
  referenceTitles?: string[]
  /** 구조·내용 레퍼런스 구분 (권장) */
  guideReferences?: ContentPolishReference[]
  /** Gemini 모델 ID */
  aiModel?: string
}

export interface ContentPolishResult {
  title: string
  fullContent: string
  summary: string
  imageGuideCount: number
  polishedAt: string
}

/** 본문 문단 수 추정 (빈 줄·헤더·가이드 블록 제외) */
export function estimateParagraphCount(text: string): number {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && !l.startsWith('#') && !l.startsWith('>')).length
}

/** 문단 수 기준 권장 환기용 이미지 가이드 개수 (약 3~4문단당 1장, 10문단 → 3장 내외) */
export function suggestImageGuideCount(paragraphCount: number): number {
  if (paragraphCount <= 3) return 1
  return Math.min(5, Math.max(2, Math.round(paragraphCount / 3.5)))
}

const IMAGE_GUIDE_TEMPLATE = `
> **📷 [환기용 이미지 가이드 N/M — 직접 제작·삽입]**
> - **삽입 위치:** (어느 H2·문단 직후인지)
> - **이미지 유형:** (일러스트 / 인포그래픽 / 스크린샷 / 다이어그램 / 표 등)
> - **화면 구성:** (주요 오브젝트·색감·텍스트 오버레이)
> - **전달 메시지:** (이 구간 독자가 얻어야 할 한 줄)
> - **캡션 예시:** (20자 내외)
`.trim()

export function buildContentPolishPrompt(req: ContentPolishRequest): string {
  const paraCount = estimateParagraphCount(req.fullScript)
  const imageCount = req.category === 'writing' || req.targetFormat === 'blog'
    ? suggestImageGuideCount(paraCount)
    : 0

  const polishRefs: ContentPolishReference[] =
    req.guideReferences?.length
      ? req.guideReferences
      : (req.referenceTitles ?? []).map((title) => ({ title, referenceMode: 'structure' as const }))

  const structureRefs = polishRefs.filter((r) => r.referenceMode !== 'content')
  const contentRefs = polishRefs.filter((r) => r.referenceMode === 'content')

  let refBlock = ''
  if (structureRefs.length > 0) {
    refBlock += `\n[구조·톤 레퍼런스 — 본문에서 채널명·제목·표현 흔적 완전 제거·패러프레이즈]\n${structureRefs.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}\n`
  }
  if (contentRefs.length > 0) {
    refBlock += `\n[내용 레퍼런스 — 사실·데이터·설명은 유지하되 출처·사이트명·URL 언급 제거, 완전히 새 문장으로 재서술]\n${contentRefs.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}\n`
  }

  const topicBlock = req.userTopic?.trim()
    ? `\n[발행 주제 — 반드시 이 주제를 유지]\n${req.userTopic.trim()}\n`
    : ''

  const blogImageRules =
    imageCount > 0
      ? `
## 블로그 환기용 이미지·표 가이드 (필수)
- 본문 추정 ${paraCount}문단 → **환기용 이미지 가이드 ${imageCount}개** 내외를 본문 중간에 삽입하세요.
- 실제 이미지 파일을 생성하지 마세요. 아래 형식의 **텍스트 가이드 블록**만 넣습니다.
- 가이드는 H2 섹션 사이·긴 문단 묶음 직후 등 읽기 흐름이 답답해지기 전에 배치하세요.
- 1~2곳은 **표 가이드**로 대체 가능 (비교·체크리스트·숫자 요약 등).

가이드 블록 형식 (그대로 사용):
${IMAGE_GUIDE_TEMPLATE.replace('N/M', `1/${imageCount}`)}

표 가이드 예시:
> **📊 [표 가이드 — 직접 제작·삽입]**
> - **삽입 위치:** ...
> - **표 제목:** ...
> - **열 구성:** ...
> - **행 예시:** ...
`
      : ''

  return `당신은 콘텐츠 에디터입니다. 아래 «가이드 초안»을 **내가 직접 발행한 오리지널 콘텐츠**처럼 정재해 주세요.
${topicBlock}${refBlock}
## 정재 원칙
1. **구조·톤 레퍼런스**에서 온 채널명·타 채널·영상·블로그 제목·표현은 본문에서 **완전히 제거**하거나 새 표현으로 바꿉니다. «OO 채널», «벤치마킹», «레퍼런스» 같은 메타 표현 금지.
2. **내용 레퍼런스**에서 반영된 사실·수치·설명은 **발행 주제에 맞게 유지**하되, 출처·사이트명·URL·«OO 위키에 따르면» 같은 인용 표현은 제거하고 **완전히 새 문장**으로 재서술합니다.
3. 제목·소제목·본문을 **독자에게 직접 말하는 발행용 톤**으로 다듭니다. 표절·직접 인용 없이 사실·논지만 유지합니다.
4. SEO 친화적 H2 구조, 도입·본문·마무리·CTA를 유지합니다.
5. 포맷: ${req.targetFormat} · 카테고리: ${req.category}
${blogImageRules}

## 출력 형식
반드시 JSON만 응답 (다른 텍스트 없이):
{
  "title": "발행용 제목",
  "fullContent": "마크다운 전체 본문 (이미지·표 가이드 블록 포함)",
  "summary": "정재 시 변경한 점 2~3문장",
  "imageGuideCount": ${imageCount}
}

## 가이드 초안
제목: ${req.title}

${req.fullScript}`
}

export function parseContentPolishResponse(text: string, fallbackTitle: string): ContentPolishResult | null {
  if (!text.trim()) return null
  try {
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fence ? fence[1].trim() : text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
    const parsed = JSON.parse(fixed) as {
      title?: string
      fullContent?: string
      summary?: string
      imageGuideCount?: number
    }
    const fullContent = String(parsed.fullContent ?? '').trim()
    if (!fullContent) return null
    return {
      title: String(parsed.title ?? fallbackTitle).trim() || fallbackTitle,
      fullContent,
      summary: String(parsed.summary ?? '레퍼런스 흔적을 제거하고 발행용 톤으로 정재했습니다.').trim(),
      imageGuideCount: Number(parsed.imageGuideCount) || 0,
      polishedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
