import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { ScriptGuideOutput, ChapterMarker } from '@/lib/dashboard/script-guide-output'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import type { BlogPlatformVariants } from '@/lib/dashboard/blog-platform-variants'

export type { ChapterMarker }

export interface GenerationHistoryDraft {
  title: string
  fullScript: string
  hook?: string
  cta?: string
  chapterSummary?: string[]
  chapterMarkers?: ChapterMarker[]
  seoKeywords?: string[]
  mode: ScriptGuideOutput['mode']
  targetFormat: ContentFormat
  platform: string
  topic: string
  generatedAt: string
}

export interface GenerationHistoryPolished {
  title: string
  fullContent: string
  summary: string
  imageGuideCount: number
  polishedAt: string
  /** 블로그: 네이버/티스토리/Blogger 동시 발행용 제목·메타·태그 변형 */
  platformVariants?: BlogPlatformVariants
  /** 주식 리포트 전용 — fullContent 내 output_N.png 가이드 블록에 대응하는 차트 번호 목록 */
  chartIndexes?: number[]
  /** 주식 리포트 전용 — output_N.png → 종목별 슬라이드 PNG 상대경로 매핑(slideFiles[i]는 chartIndexes[i]에 대응) */
  chartImages?: { name: string; slideFiles: string[] }[]
}

export interface GenerationHistoryItem {
  id: string
  publishTopic: string
  category: GuideCategory
  referenceCount: number
  referenceTitles: string[]
  draft: GenerationHistoryDraft
  polished?: GenerationHistoryPolished
  createdAt: string
  updatedAt: string
}

export function scriptToDraft(result: ScriptGuideOutput): GenerationHistoryDraft {
  return {
    title: result.title,
    fullScript: result.fullScript,
    hook: result.hook,
    cta: result.cta,
    chapterSummary: result.chapterSummary,
    chapterMarkers: result.chapterMarkers,
    seoKeywords: result.seoKeywords,
    mode: result.mode,
    targetFormat: result.targetFormat,
    platform: result.platform,
    topic: result.topic,
    generatedAt: result.generatedAt,
  }
}

export function polishToHistory(polished: ContentPolishResult): GenerationHistoryPolished {
  return {
    title: polished.title,
    fullContent: polished.fullContent,
    summary: polished.summary,
    imageGuideCount: polished.imageGuideCount,
    polishedAt: polished.polishedAt,
    platformVariants: polished.platformVariants,
  }
}

export function draftToScriptOutput(
  draft: GenerationHistoryDraft,
  category: GuideCategory,
): ScriptGuideOutput {
  const intent: ScriptGuideOutput['intent'] =
    category === 'writing' ? 'blog'
    : category === 'image' ? 'carousel'
    : draft.targetFormat === 'longform' ? 'longform_video'
    : 'shortform_video'

  return {
    mode: draft.mode,
    category,
    intent,
    targetFormat: draft.targetFormat,
    platform: draft.platform,
    topic: draft.topic,
    title: draft.title,
    fullScript: draft.fullScript,
    hook: draft.hook,
    cta: draft.cta,
    seoKeywords: draft.seoKeywords,
    chapterSummary: draft.chapterSummary,
    chapterMarkers: draft.chapterMarkers,
    generatedAt: draft.generatedAt,
  }
}
