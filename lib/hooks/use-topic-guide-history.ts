'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { TopicGuideHistoryItem } from '@/lib/dashboard/topic-guide-history-types'
import type { TopicKeywordGuideSuggestion } from '@/lib/dashboard/topic-keyword-guide'

export type { TopicGuideHistoryItem } from '@/lib/dashboard/topic-guide-history-types'

async function fetchTopicGuideHistoryItems(): Promise<TopicGuideHistoryItem[]> {
  const res = await fetch('/api/dashboard/topic-guide-history')
  if (!res.ok) return []
  const data = (await res.json()) as { items?: TopicGuideHistoryItem[] }
  return data.items ?? []
}

export function useTopicGuideHistory() {
  const [items, setItems] = useState<TopicGuideHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      setItems(await fetchTopicGuideHistoryItems())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const addFromGuide = useCallback(
    async (input: {
      seedKeyword: string
      category: GuideCategory
      suggestions: TopicKeywordGuideSuggestion[]
      guideGeneratedAt?: string
    }): Promise<string | null> => {
      try {
        const res = await fetch('/api/dashboard/topic-guide-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = (await res.json()) as { item?: TopicGuideHistoryItem; error?: string }
        if (!res.ok || !data.item) return null
        setItems((prev) => [data.item!, ...prev.filter((x) => x.id !== data.item!.id)].slice(0, 30))
        return data.item.id
      } catch {
        return null
      }
    },
    [],
  )

  const attachSelection = useCallback(
    async (id: string, selected: TopicKeywordGuideSuggestion, selectedPublishTopic: string) => {
      try {
        const res = await fetch('/api/dashboard/topic-guide-history', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            selectedSuggestion: selected,
            selectedPublishTopic,
          }),
        })
        const data = (await res.json()) as { item?: TopicGuideHistoryItem; error?: string }
        if (!res.ok || !data.item) return
        setItems((prev) => prev.map((x) => (x.id === id ? data.item! : x)))
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const removeItem = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/topic-guide-history?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) return
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch {
      /* ignore */
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/topic-guide-history?all=1', { method: 'DELETE' })
      if (!res.ok) return
      setItems([])
    } catch {
      /* ignore */
    }
  }, [])

  return { items, isLoading, reload, addFromGuide, attachSelection, removeItem, clearAll }
}
