import { supabaseAdmin } from '@/lib/data/supabase-admin'

interface ChannelRow {
  channel_id: string
  channel_name: string
  platform: string
  subscribers: number
  total_views: number
  video_count: number
  avg_views: number
  updated_at: string
}

interface VideoRow {
  platform: string
  video_id: string
  channel_id: string
  channel_name: string
  title: string
  thumbnail_url: string
  views: number
  likes: number
  comments: number
  duration: number
  format: string
  published_at: string | null
  avg_views: number
  vs_avg: number
  tier: string
  score: number
  scraped_at: string
}

/**
 * 채널 정보와 영상/포스트 목록을 Supabase에 upsert합니다.
 * naver-blog, tistory 수집에서 공통으로 사용됩니다.
 */
export async function persistChannelAndVideos(
  channelRow: ChannelRow,
  videoRows: VideoRow[],
): Promise<{ ok: boolean; error?: string }> {
  const { error: chErr } = await supabaseAdmin
    .from('channels')
    .upsert(channelRow, { onConflict: 'channel_id' })

  if (chErr) {
    return { ok: false, error: `채널 저장 실패: ${chErr.message}` }
  }

  if (videoRows.length > 0) {
    const { error: postErr } = await supabaseAdmin
      .from('videos')
      .upsert(videoRows, { onConflict: 'video_id' })
    if (postErr) {
      return { ok: false, error: `글 저장 실패: ${postErr.message}` }
    }
  }

  return { ok: true }
}
