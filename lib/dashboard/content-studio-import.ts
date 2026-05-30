import type { ContentFormat } from '@/app/api/dashboard/content-generate/route'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'

export const LS_CONTENT_STUDIO_IMPORT = 'content-studio-import-v1'

export interface ContentStudioImportPayload {
  platform: string
  format: ContentFormat | 'script'
  title: string
  body: string
  notes?: string
}

export function categoryToDefaultPlatform(category: GuideCategory): string {
  if (category === 'writing') return 'naver-blog'
  if (category === 'image') return 'instagram'
  return 'youtube'
}

export function categoryToDefaultFormat(category: GuideCategory): ContentFormat | 'script' {
  if (category === 'writing') return 'blog'
  if (category === 'image') return 'carousel'
  return 'longform'
}

export function saveContentStudioImport(payload: ContentStudioImportPayload): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_CONTENT_STUDIO_IMPORT, JSON.stringify(payload))
}

export function peekContentStudioImport(): ContentStudioImportPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_CONTENT_STUDIO_IMPORT)
    if (!raw) return null
    return JSON.parse(raw) as ContentStudioImportPayload
  } catch {
    return null
  }
}

export function consumeContentStudioImport(): ContentStudioImportPayload | null {
  const data = peekContentStudioImport()
  if (!data) return null
  localStorage.removeItem(LS_CONTENT_STUDIO_IMPORT)
  return data
}
