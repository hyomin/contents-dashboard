import { NextResponse } from 'next/server'
import { getChannels, getVideoCountByChannel, getVideoStats } from '@/lib/queries'

export async function GET() {
  const [channels, stats, videoCountByChannel] = await Promise.all([
    getChannels('youtube'),
    getVideoStats(),
    getVideoCountByChannel(),
  ])

  return NextResponse.json({
    stats,
    channels: channels.map((ch) => ({
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      subscribers: ch.subscribers,
      avg_views: ch.avg_views,
      video_count: ch.video_count,
      updated_at: ch.updated_at,
      videos_in_db: videoCountByChannel[ch.channel_id] ?? 0,
    })),
  })
}
