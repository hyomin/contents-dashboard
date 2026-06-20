export const getTierColor = (tier: string) =>
  ({ S: 'bg-purple-100 text-purple-800 border border-purple-300', A: 'bg-blue-100 text-blue-800 border border-blue-300', B: 'bg-green-100 text-green-800 border border-green-300', C: 'bg-gray-100 text-gray-700 border border-gray-300' }[tier] ?? 'bg-gray-100 text-gray-700')

export const getPlatformName = (p: string) =>
  ({
    youtube: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    blogger: 'Google Blogger',
    'naver-blog': '네이버',
    tistory: '티스토리',
  }[p] ?? p)

export const getPlatformIcon = (p: string) =>
  ({
    youtube: '🔴',
    tiktok: '🎵',
    instagram: '💗',
    blogger: '🌐',
    'naver-blog': '🟢',
    tistory: '🟠',
  }[p] ?? '🔗')

export const getPlatformColor = (p: string) =>
  ({
    youtube: 'bg-red-100 text-red-700',
    tiktok: 'bg-gray-900 text-white',
    instagram: 'bg-pink-100 text-pink-700',
    blogger: 'bg-sky-100 text-sky-800',
    'naver-blog': 'bg-green-100 text-green-700',
    tistory: 'bg-orange-100 text-orange-700',
  }[p] ?? 'bg-gray-100 text-gray-700')

export const getVsAvgColor = (v: number) =>
  v >= 3.0 ? 'text-green-600 font-bold' : v >= 2.0 ? 'text-yellow-600 font-semibold' : 'text-gray-500'

export const formatViews = (v: number) =>
  v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()

import type { DBVideo } from '@/lib/data/supabase'
import type { Video } from './dashboard-types'
import type { VideoFormat } from '@/lib/data/video-format'
import { classifyVideoFormat } from '@/lib/data/video-format'

export function dbVideoToVideo(v: DBVideo, index?: number): Video {
  const format = (v.format as VideoFormat | null) ?? classifyVideoFormat(v.duration, v.title)
  return {
    id: v.id ?? index ?? 0,
    videoId: v.video_id,
    tier: (v.tier ?? 'C') as Video['tier'],
    title: v.title,
    channel: v.channel_name ?? '',
    channelId: v.channel_id ?? undefined,
    views: v.views ?? 0,
    vsAvg: Number(v.vs_avg ?? 0),
    platform: (v.platform ?? 'youtube') as Video['platform'],
    publishedAt: v.published_at?.split('T')[0] ?? '',
    keyword: '',
    duration: v.duration ?? undefined,
    format,
    thumbnailUrl: v.thumbnail_url ?? undefined,
  }
}

export interface OutlierTagRow {
  video_id: string
  title: string
  channel_id: string | null
  channel_name: string | null
  platform: string
  vs_avg: number
  min_vs_avg_threshold: number
  tagged_at: string
  source: string
  updated_at: string
  format?: string | null
}

export function tierForVsAvg(vsAvg: number): 'S' | 'A' | 'B' | 'C' {
  if (vsAvg >= 5) return 'S'
  if (vsAvg >= 3) return 'A'
  if (vsAvg >= 1.5) return 'B'
  return 'C'
}

export function outlierTagToVideo(row: OutlierTagRow, index = 0): Video {
  const vsAvg = Number(row.vs_avg ?? 0)
  return {
    id: index,
    videoId: row.video_id,
    tier: tierForVsAvg(vsAvg),
    title: row.title,
    channel: row.channel_name ?? '',
    channelId: row.channel_id ?? undefined,
    views: 0,
    vsAvg,
    platform: (row.platform ?? 'youtube') as Video['platform'],
    publishedAt: row.tagged_at?.split('T')[0] ?? '',
    keyword: 'outlier-tag',
    format: (row.format ?? undefined) as VideoFormat | undefined,
  }
}
