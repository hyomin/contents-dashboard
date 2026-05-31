import type { Video } from '@/lib/dashboard/dashboard-types'
import type { DBVideo } from '@/lib/data/supabase'
import { dbVideoToVideo } from '@/lib/dashboard/dashboard-helpers'
import type { PlanningQueueItem } from '@/lib/hooks/use-planning-queue'
import type { GuideReferenceMode } from '@/lib/dashboard/guide-reference-modes'

export type GuideReferenceSource = 'content' | 'rss' | 'trending' | 'insight' | 'web'

export interface GuideReference {
  id: string
  title: string
  platform: string
  channelId?: string
  channel?: string
  vsAvg?: number
  views?: number
  tier?: string
  url?: string
  publishedAt?: string
  sourceType?: GuideReferenceSource
  /** structure = 제목·목차·톤만 / content = 페이지 내용·사실 반영 */
  referenceMode?: GuideReferenceMode
  /** content 모드 시 수집된 본문 발췌 */
  contentExcerpt?: string
  siteName?: string
}

function uniqueRefId(prefix: string, baseId: string | number): string {
  return `${prefix}-${baseId}-${Date.now()}`
}

export function normalizeGuideReference(ref: GuideReference): GuideReference {
  return {
    ...ref,
    referenceMode: ref.referenceMode === 'content' ? 'content' : 'structure',
  }
}

export function createWebGuideReference(input: {
  url: string
  title: string
  siteName?: string
  referenceMode: GuideReferenceMode
  contentExcerpt?: string
}): GuideReference {
  return normalizeGuideReference({
    id: uniqueRefId('web', input.url.slice(-24)),
    title: input.title.trim() || input.url,
    platform: 'web',
    url: input.url.trim(),
    siteName: input.siteName?.trim(),
    channel: input.siteName?.trim(),
    sourceType: 'web',
    referenceMode: input.referenceMode,
    contentExcerpt: input.contentExcerpt,
  })
}

export function rssTopicToGuideReference(t: {
  id: string | number
  title: string
  ai_title?: string | null
  link?: string | null
  source_feed?: string
}): GuideReference {
  return normalizeGuideReference({
    id: uniqueRefId('rss', t.id),
    title: (t.ai_title ?? t.title).trim(),
    platform: 'topic',
    url: t.link ?? undefined,
    channel: t.source_feed,
    sourceType: 'rss',
    referenceMode: 'structure',
  })
}

export function planningItemToGuideReference(item: PlanningQueueItem): GuideReference {
  const title = (item.detail ?? item.keyword).trim()
  return normalizeGuideReference({
    id: uniqueRefId('insight', item.id),
    title,
    platform: 'insight',
    channel: item.icon ? `${item.icon} AI 인사이트` : 'AI 인사이트',
    sourceType: 'insight',
    referenceMode: 'structure',
  })
}

export function trendingTopicToGuideReference(t: {
  id: string | number
  title: string
  ai_title?: string | null
  link?: string | null
  sources?: string[]
}): GuideReference {
  return normalizeGuideReference({
    id: uniqueRefId('trending', t.id),
    title: (t.ai_title ?? t.title).trim(),
    platform: 'topic',
    url: t.link ?? undefined,
    channel: t.sources?.slice(0, 3).join(', '),
    sourceType: 'trending',
    referenceMode: 'structure',
  })
}

export const LS_GUIDE_REFERENCES = 'dashboard_guide_references'

export function getContentUrl(platform: string, videoId: string, channelId?: string | null): string | undefined {
  if (videoId.startsWith('http')) return videoId
  if (platform === 'naver-blog') return `https://blog.naver.com/${videoId}`
  if (platform === 'youtube') return `https://www.youtube.com/watch?v=${videoId}`
  if (platform === 'tistory' && channelId) return `https://${channelId}.tistory.com/${videoId}`
  return undefined
}

export function videoToGuideReference(v: Video): GuideReference {
  return normalizeGuideReference({
    id: v.videoId,
    title: v.title,
    platform: v.platform,
    channelId: v.channelId,
    channel: v.channel,
    vsAvg: v.vsAvg,
    views: v.views,
    tier: v.tier,
    publishedAt: v.publishedAt,
    url: getContentUrl(v.platform, v.videoId, v.channelId),
    sourceType: 'content',
    referenceMode: 'structure',
  })
}

export function dbVideoToGuideReference(v: DBVideo, index?: number): GuideReference {
  const base = videoToGuideReference(dbVideoToVideo(v, index))
  return { ...base, id: uniqueRefId('content', v.video_id) }
}

export function loadGuideReferences(): GuideReference[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_GUIDE_REFERENCES)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GuideReference[]
    return Array.isArray(parsed) ? parsed.map(normalizeGuideReference) : []
  } catch {
    return []
  }
}

export function saveGuideReferences(refs: GuideReference[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_GUIDE_REFERENCES, JSON.stringify(refs.map(normalizeGuideReference)))
}

export const GUIDE_PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: '🔴' },
  { id: 'naver-blog', label: '네이버 블로그', icon: '🟢' },
  { id: 'tistory', label: '티스토리', icon: '🟠' },
] as const

export type GuidePlatformId = (typeof GUIDE_PLATFORMS)[number]['id']

export function getReferenceModeLabel(mode: GuideReferenceMode): string {
  return mode === 'content' ? '내용 반영' : '구조·톤'
}

export function getReferenceSourceLabel(ref: GuideReference): string {
  if (ref.sourceType === 'web') return ref.siteName ?? '웹'
  if (ref.sourceType === 'trending') return '급상승'
  if (ref.sourceType === 'rss') return 'RSS'
  if (ref.sourceType === 'insight') return '인사이트'
  if (ref.platform === 'topic') return '주제'
  if (ref.platform === 'web') return '웹'
  return ref.platform
}
