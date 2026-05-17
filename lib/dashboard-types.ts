export interface Video {
  id: number
  tier: 'S' | 'A' | 'B' | 'C'
  title: string
  channel: string
  views: number
  vsAvg: number
  platform: 'youtube' | 'instagram' | 'naver-blog' | 'tistory'
  publishedAt: string
  keyword: string
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'info' | 'warning'
}

export type AddToast = (message: string, type?: Toast['type']) => void
