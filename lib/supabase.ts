import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 데이터베이스 타입 정의
export interface Video {
  id: number
  platform: string
  video_id: string
  channel_name: string | null
  title: string
  thumbnail_url: string | null
  views: number
  likes: number
  comments: number
  duration: number | null
  published_at: string | null
  avg_views: number | null
  vs_avg: number | null
  tier: string | null
  score: number | null
  scraped_at: string
  created_at: string
  updated_at: string
}

export interface Channel {
  id: number
  platform: string
  channel_id: string
  channel_name: string
  subscriber_count: number | null
  total_videos: number | null
  avg_views: number | null
  created_at: string
  updated_at: string
}
