'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PlanningQueueItem {
  id: string
  keyword: string
  /** 전체 텍스트 (AI 인사이트 등) */
  detail?: string
  icon?: string
  /** 어디서 추가됐는지 */
  source: 'trending' | 'insight' | 'outlier' | 'rss' | 'manual'
  addedAt: string
  used?: boolean
}

const STORAGE_KEY = 'planning-queue-v1'
const MAX_ITEMS = 50

function readFromStorage(): PlanningQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PlanningQueueItem[]) : []
  } catch {
    return []
  }
}

function writeToStorage(items: PlanningQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function usePlanningQueue() {
  const [items, setItems] = useState<PlanningQueueItem[]>([])

  // 초기 로드
  useEffect(() => {
    setItems(readFromStorage())
  }, [])

  // 다른 탭/컴포넌트에서 storage 변경 시 동기화
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setItems(readFromStorage())
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const addItem = useCallback(
    (
      keyword: string,
      source: PlanningQueueItem['source'] = 'manual',
      options?: { detail?: string; icon?: string },
    ): boolean => {
      const trimmed = keyword.trim().slice(0, 100)
      if (!trimmed) return false

      const detail = options?.detail?.trim()
      const current = readFromStorage()
      if (current.some((x) => x.keyword === trimmed || (detail && x.detail === detail))) return false

      const next: PlanningQueueItem[] = [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          keyword: trimmed,
          detail: detail || undefined,
          icon: options?.icon,
          source,
          addedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, MAX_ITEMS)

      writeToStorage(next)
      setItems(next)
      return true
    },
    [],
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id)
      writeToStorage(next)
      return next
    })
  }, [])

  const markUsed = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, used: true } : x))
      writeToStorage(next)
      return next
    })
  }, [])

  const clearUsed = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((x) => !x.used)
      writeToStorage(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    writeToStorage([])
    setItems([])
  }, [])

  return { items, addItem, removeItem, markUsed, clearUsed, clearAll }
}

export const SOURCE_LABELS: Record<PlanningQueueItem['source'], { label: string; color: string }> =
  {
    trending: { label: '트렌딩', color: 'bg-orange-100 text-orange-700' },
    insight: { label: 'AI 인사이트', color: 'bg-violet-100 text-violet-700' },
    outlier: { label: '아웃라이어', color: 'bg-green-100 text-green-700' },
    rss: { label: 'RSS', color: 'bg-blue-100 text-blue-700' },
    manual: { label: '직접 입력', color: 'bg-gray-100 text-gray-600' },
  }
