export const getTierColor = (tier: string) =>
  ({ S: 'bg-purple-100 text-purple-800 border border-purple-300', A: 'bg-blue-100 text-blue-800 border border-blue-300', B: 'bg-green-100 text-green-800 border border-green-300', C: 'bg-gray-100 text-gray-700 border border-gray-300' }[tier] ?? 'bg-gray-100 text-gray-700')

export const getPlatformName = (p: string) =>
  ({ youtube: 'YouTube', instagram: 'Instagram', 'naver-blog': '네이버', tistory: '티스토리' }[p] ?? p)

export const getPlatformIcon = (p: string) =>
  ({ youtube: '🔴', instagram: '💗', 'naver-blog': '🟢', tistory: '🟠' }[p] ?? '🔗')

export const getPlatformColor = (p: string) =>
  ({ youtube: 'bg-red-100 text-red-700', instagram: 'bg-pink-100 text-pink-700', 'naver-blog': 'bg-green-100 text-green-700', tistory: 'bg-orange-100 text-orange-700' }[p] ?? 'bg-gray-100 text-gray-700')

export const getVsAvgColor = (v: number) =>
  v >= 3.0 ? 'text-green-600 font-bold' : v >= 2.0 ? 'text-yellow-600 font-semibold' : 'text-gray-500'

export const formatViews = (v: number) =>
  v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString()

import type { DBVideo } from './supabase'
import type { Video } from './dashboard-types'

export function dbVideoToVideo(v: DBVideo, index: number): Video {
  return {
    id: index + 1,
    tier: (v.tier ?? 'C') as Video['tier'],
    title: v.title,
    channel: v.channel_name ?? '',
    views: v.views ?? 0,
    vsAvg: Number(v.vs_avg ?? 0),
    platform: (v.platform ?? 'youtube') as Video['platform'],
    publishedAt: v.published_at?.split('T')[0] ?? '',
    keyword: '',
  }
}
