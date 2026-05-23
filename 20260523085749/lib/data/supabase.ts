import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface DBVideo {
  id: number
  platform: string
  video_id: string
  channel_id: string | null
  channel_name: string | null
  title: string
  thumbnail_url: string | null
  views: number
  likes: number
  comments: number
  duration: number | null
  format: string | null
  published_at: string | null
  avg_views: number | null
  vs_avg: number | null
  tier: string | null
  score: number | null
  scraped_at: string
  created_at: string
  updated_at: string
}

export interface DBChannel {
  id: number
  platform: string
  channel_id: string
  channel_name: string
  category_id: string | null
  subscribers: number | null
  total_views: number | null
  video_count: number | null
  avg_views: number | null
  created_at: string
  updated_at: string
}
