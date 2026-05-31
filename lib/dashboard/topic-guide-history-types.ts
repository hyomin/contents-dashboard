import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { TopicKeywordGuideSuggestion } from '@/lib/dashboard/topic-keyword-guide'

export interface TopicGuideHistoryItem {
  id: string
  seedKeyword: string
  category: GuideCategory
  suggestions: TopicKeywordGuideSuggestion[]
  selectedSuggestion?: TopicKeywordGuideSuggestion
  selectedPublishTopic?: string
  guideGeneratedAt?: string
  createdAt: string
  updatedAt: string
}

export function suggestionToHistory(s: TopicKeywordGuideSuggestion): TopicKeywordGuideSuggestion {
  return {
    id: String(s.id),
    title: String(s.title).trim(),
    hook: String(s.hook ?? '').trim(),
    angle: s.angle ? String(s.angle).trim() : undefined,
  }
}
