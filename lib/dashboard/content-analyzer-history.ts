import type { ContentAnalyzerResult } from '@/lib/dashboard/content-analyzer'

export interface ContentAnalyzerHistoryItem {
  id: string
  url: string
  platform: ContentAnalyzerResult['platform']
  notes?: string
  canWatchDirectly: boolean
  result: ContentAnalyzerResult
  createdAt: string
}

const STORAGE_KEY = 'dashboard_content_analyzer_history'
const MAX_ITEMS = 20

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function loadContentAnalyzerHistory(): ContentAnalyzerHistoryItem[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ContentAnalyzerHistoryItem[]) : []
  } catch {
    return []
  }
}

function saveContentAnalyzerHistory(items: ContentAnalyzerHistoryItem[]): void {
  if (!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

export function addContentAnalyzerHistoryItem(input: {
  url: string
  notes?: string
  canWatchDirectly: boolean
  result: ContentAnalyzerResult
}): ContentAnalyzerHistoryItem {
  const item: ContentAnalyzerHistoryItem = {
    id: `analyzer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: input.url,
    platform: input.result.platform,
    notes: input.notes?.trim() || undefined,
    canWatchDirectly: input.canWatchDirectly,
    result: input.result,
    createdAt: new Date().toISOString(),
  }
  const next = [item, ...loadContentAnalyzerHistory()]
  saveContentAnalyzerHistory(next)
  return item
}

export function removeContentAnalyzerHistoryItem(id: string): ContentAnalyzerHistoryItem[] {
  const next = loadContentAnalyzerHistory().filter((x) => x.id !== id)
  saveContentAnalyzerHistory(next)
  return next
}

export function clearContentAnalyzerHistory(): void {
  saveContentAnalyzerHistory([])
}
