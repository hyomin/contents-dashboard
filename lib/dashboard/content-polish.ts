import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { GuideReferenceMode } from '@/lib/dashboard/guide-reference-modes'
import {
  buildAgentFormatGuidelineBlock,
  getAgentGuidelineSection,
  getBlogImageAgentBlock,
} from '@/lib/dashboard/contents-guideline'
import { prependGeminiFlowPasteBlock } from '@/lib/dashboard/gemini-flow-paste'
import { sanitizeGeminiJsonText } from '@/lib/dashboard/gemini-models'
import {
  BLOG_PLATFORM_VARIANTS_SCHEMA,
  parseBlogPlatformVariants,
  type BlogPlatformVariants,
} from '@/lib/dashboard/blog-platform-variants'

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
  /** 숏폼 카테고리 (영상·shortform 정재 시) */
  shortformCategoryId?: string
}

export interface ContentPolishResult {
  title: string
  fullContent: string
  summary: string
  imageGuideCount: number
  polishedAt: string
  /** 숏폼: Gemini/Flow 붙여넣기용 (최상단 고정 전 원문) */
  flowPasteBlock?: string
  /** 블로그: 네이버/티스토리/Blogger 동시 발행용 제목·메타·태그 변형 */
  platformVariants?: BlogPlatformVariants
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

function isShortformPolish(req: ContentPolishRequest): boolean {
  return req.targetFormat === 'shortform'
}

function isLongformPolish(req: ContentPolishRequest): boolean {
  return req.targetFormat === 'longform'
}

export function buildContentPolishPrompt(req: ContentPolishRequest): string {
  const shortform = isShortformPolish(req)
  const longform = isLongformPolish(req)
  const paraCount = estimateParagraphCount(req.fullScript)
  const imageCount = !shortform && (req.category === 'writing' || req.targetFormat === 'blog')
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

  const commonGuideline = getAgentGuidelineSection('common')
  const formatGuideline = shortform
    ? buildAgentFormatGuidelineBlock('shortform', req.shortformCategoryId)
    : imageCount > 0
      ? `${buildAgentFormatGuidelineBlock('blog')}\n\n- 본문 추정 ${paraCount}문단 → 환기용 이미지 가이드 **${imageCount}개** 내외 삽입`
      : ''

  const blogImageFromMd = imageCount > 0 ? getBlogImageAgentBlock(imageCount) : ''
  const guidelineBlock = [commonGuideline, formatGuideline, blogImageFromMd].filter(Boolean).join('\n\n')

  return `당신은 콘텐츠 에디터입니다. 아래 «가이드 초안»을 **내가 직접 발행한 오리지널 콘텐츠**처럼 정재해 주세요.
${topicBlock}${refBlock}

## 가이드라인 (guidelines/contents_guideline.md)
${guidelineBlock || '(가이드라인 로드 실패 — 정재 원칙만 적용)'}

포맷: ${req.targetFormat} · 카테고리: ${req.category}

## 출력 형식
반드시 JSON만 응답 (다른 텍스트 없이):
{
  "title": "발행용 제목",
  "flowPasteBlock": ${shortform ? '"씬별 ### 씬N · 시간 · 제목 + Flow용 영문 한 덩어리 (유일한 Flow 위치, 중복 문장 금지)"' : 'null'},
  "fullContent": "${
    shortform
      ? '장면별 [0~N초]·화면(한글)·자막·제작 메모 (Google Flow 줄 없음)'
      : longform
        ? '챕터별 내레이션 전체 대본 (마크다운 ## 챕터 제목 + 실제로 읽는 문장체 본문, Flow·씬 표기 없음)'
        : '마크다운 전체 본문 (이미지·표 가이드 블록 포함)'
  }",
  "summary": "정재 시 변경한 점 2~3문장${shortform ? ' (장면 수·Flow 씬 요약 포함)' : longform ? ' (챕터 구성 요약)' : ''}",
  "imageGuideCount": ${imageCount}${
    imageCount > 0
      ? `,
  ${BLOG_PLATFORM_VARIANTS_SCHEMA}`
      : ''
  }
}

## 가이드 초안
제목: ${req.title}

${req.fullScript}`
}

export interface ParseContentPolishOptions {
  shortform?: boolean
}

export function parseContentPolishResponse(
  text: string,
  fallbackTitle: string,
  options?: ParseContentPolishOptions,
): ContentPolishResult | null {
  if (!text.trim()) return null
  try {
    // 1차: 원문 그대로 시도 → 실패 시 흔한 LLM JSON 깨짐(이스케이프 누락 등)을 보정해 재시도
    const sanitized = sanitizeGeminiJsonText(text)
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fence ? fence[1].trim() : text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch && !sanitized) return null
    const raw = jsonMatch ? jsonMatch[0].replace(/,\s*([}\]])/g, '$1') : null

    let parsed: Record<string, unknown> | null = null
    for (const candidate of [raw, sanitized]) {
      if (!candidate) continue
      try {
        parsed = JSON.parse(candidate)
        break
      } catch {
        // 다음 후보로
      }
    }
    if (!parsed) return null

    let fullContent = String(parsed.fullContent ?? '').trim()
    if (!fullContent) return null
    const flowPasteBlock = String(parsed.flowPasteBlock ?? '').trim() || undefined
    if (options?.shortform) {
      fullContent = prependGeminiFlowPasteBlock(fullContent, flowPasteBlock)
    }
    return {
      title: String(parsed.title ?? fallbackTitle).trim() || fallbackTitle,
      fullContent,
      summary: String(parsed.summary ?? '레퍼런스 흔적을 제거하고 발행용 톤으로 정재했습니다.').trim(),
      imageGuideCount: Number(parsed.imageGuideCount) || 0,
      polishedAt: new Date().toISOString(),
      flowPasteBlock,
      platformVariants: parseBlogPlatformVariants(parsed),
    }
  } catch {
    return null
  }
}
