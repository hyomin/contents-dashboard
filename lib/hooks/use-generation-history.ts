'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import type { ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import {
  draftToScriptOutput,
  type GenerationHistoryItem,
} from '@/lib/dashboard/generation-history-types'

export type {
  GenerationHistoryDraft,
  GenerationHistoryItem,
  GenerationHistoryPolished,
} from '@/lib/dashboard/generation-history-types'
export { draftToScriptOutput }

const LEGACY_STORAGE_KEY = 'content-generation-history-v1'
const MIGRATED_KEY = 'content-generation-history-migrated-v1'

async function fetchHistoryItems(): Promise<GenerationHistoryItem[]> {
  const res = await fetch('/api/dashboard/generation-history')
  if (!res.ok) return []
  const data = (await res.json()) as { items?: GenerationHistoryItem[] }
  return data.items ?? []
}

async function migrateLegacyLocalStorage(serverItems: GenerationHistoryItem[]): Promise<GenerationHistoryItem[]> {
  if (typeof window === 'undefined') return serverItems
  if (localStorage.getItem(MIGRATED_KEY)) return serverItems

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(MIGRATED_KEY, '1')
      return serverItems
    }

    const legacy = JSON.parse(raw) as GenerationHistoryItem[]
    localStorage.setItem(MIGRATED_KEY, '1')
    localStorage.removeItem(LEGACY_STORAGE_KEY)

    if (legacy.length === 0 || serverItems.length > 0) return serverItems

    const res = await fetch('/api/dashboard/generation-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'migrate', items: legacy }),
    })
    if (res.ok) return fetchHistoryItems()
  } catch {
    /* ignore migration errors */
  }
  return serverItems
}

export function useGenerationHistory() {
  const [items, setItems] = useState<GenerationHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      let list = await fetchHistoryItems()
      list = await migrateLegacyLocalStorage(list)
      setItems(list)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const addFromGeneration = useCallback(
    async (input: {
      result: ScriptGuideOutput
      publishTopic: string
      category: GuideCategory
      referenceTitles: string[]
    }): Promise<string | null> => {
      try {
        const res = await fetch('/api/dashboard/generation-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result: input.result,
            publishTopic: input.publishTopic,
            category: input.category,
            referenceTitles: input.referenceTitles,
          }),
        })
        const data = (await res.json()) as { item?: GenerationHistoryItem; error?: string }
        if (!res.ok || !data.item) return null
        setItems((prev) => [data.item!, ...prev.filter((x) => x.id !== data.item!.id)].slice(0, 30))
        return data.item.id
      } catch {
        return null
      }
    },
    [],
  )

  const attachPolished = useCallback(async (id: string, polished: ContentPolishResult) => {
    try {
      const res = await fetch('/api/dashboard/generation-history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, polished }),
      })
      const data = (await res.json()) as { item?: GenerationHistoryItem; error?: string }
      if (!res.ok || !data.item) return
      setItems((prev) => prev.map((x) => (x.id === id ? data.item! : x)))
    } catch {
      /* ignore */
    }
  }, [])

  const removeItem = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/generation-history?id=${encodeURIComponent(id)}`, {
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
      const res = await fetch('/api/dashboard/generation-history?all=1', { method: 'DELETE' })
      if (!res.ok) return
      setItems([])
    } catch {
      /* ignore */
    }
  }, [])

  return { items, isLoading, reload, addFromGeneration, attachPolished, removeItem, clearAll }
}
