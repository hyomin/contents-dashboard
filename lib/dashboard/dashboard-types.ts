import type { VideoFormat } from '@/lib/data/video-format'

export interface Video {
  id: number
  videoId: string
  tier: 'S' | 'A' | 'B' | 'C'
  title: string
  channel: string
  channelId?: string
  views: number
  vsAvg: number
  platform: 'youtube' | 'tiktok' | 'instagram' | 'naver-blog' | 'tistory'
  publishedAt: string
  keyword: string
  duration?: number
  format?: VideoFormat
  thumbnailUrl?: string
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'info' | 'warning'
}

export type ToastKind = 'collect' | 'ai' | 'error' | 'general'

export type AddToast = (message: string, type?: Toast['type'], kind?: ToastKind) => void
