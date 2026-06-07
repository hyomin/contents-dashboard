import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { ScriptGuideOutput, ChapterMarker } from '@/lib/dashboard/script-guide-output'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'

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
