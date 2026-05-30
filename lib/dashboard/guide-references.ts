import type { Video } from '@/lib/dashboard/dashboard-types'
import type { DBVideo } from '@/lib/data/supabase'
import { dbVideoToVideo } from '@/lib/dashboard/dashboard-helpers'
import type { PlanningQueueItem } from '@/lib/hooks/use-planning-queue'

export type GuideReferenceSource = 'content' | 'rss' | 'trending' | 'insight'

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
}

function uniqueRefId(prefix: string, baseId: string | number): string {
  return `${prefix}-${baseId}-${Date.now()}`
}

export function rssTopicToGuideReference(t: {
  id: string | number
  title: string
  ai_title?: string | null
  link?: string | null
  source_feed?: string
}): GuideReference {
  return {
    id: uniqueRefId('rss', t.id),
    title: (t.ai_title ?? t.title).trim(),
    platform: 'topic',
    url: t.link ?? undefined,
    channel: t.source_feed,
    sourceType: 'rss',
  }
}

export function planningItemToGuideReference(item: PlanningQueueItem): GuideReference {
  const title = (item.detail ?? item.keyword).trim()
  return {
    id: uniqueRefId('insight', item.id),
    title,
    platform: 'insight',
    channel: item.icon ? `${item.icon} AI 인사이트` : 'AI 인사이트',
    sourceType: 'insight',
  }
}

export function trendingTopicToGuideReference(t: {
  id: string | number
  title: string
  ai_title?: string | null
  link?: string | null
  sources?: string[]
}): GuideReference {
  return {
    id: uniqueRefId('trending', t.id),
    title: (t.ai_title ?? t.title).trim(),
    platform: 'topic',
    url: t.link ?? undefined,
    channel: t.sources?.slice(0, 3).join(', '),
    sourceType: 'trending',
  }
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
  return {
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
  }
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
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGuideReferences(refs: GuideReference[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_GUIDE_REFERENCES, JSON.stringify(refs))
}

export const GUIDE_PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: '🔴' },
  { id: 'naver-blog', label: '네이버 블로그', icon: '🟢' },
  { id: 'tistory', label: '티스토리', icon: '🟠' },
] as const

export type GuidePlatformId = (typeof GUIDE_PLATFORMS)[number]['id']
