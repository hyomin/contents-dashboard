import { NextRequest, NextResponse } from 'next/server'
import { getChannels, getVideoCountByChannel, getVideoStats } from '@/lib/data/queries'
import { PLATFORMS_WITH_COLLECTION } from '@/lib/dashboard/platforms'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const platformParam = searchParams.get('platform')

  // platform 지정 시 해당 플랫폼만, 미지정 시 수집 가능 전 플랫폼
  const platforms = platformParam
    ? [platformParam]
    : [...PLATFORMS_WITH_COLLECTION]

  const [allChannels, stats, videoCountByChannel] = await Promise.all([
    Promise.all(platforms.map((p) => getChannels(p))).then((groups) =>
      groups.flat(),
    ),
    getVideoStats(),
    getVideoCountByChannel(),
  ])

  return NextResponse.json({
    stats,
    platforms,
    channels: allChannels.map((ch) => ({
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      platform: ch.platform,
      subscribers: ch.subscribers,
      avg_views: ch.avg_views,
      video_count: ch.video_count,
      updated_at: ch.updated_at,
      videos_in_db: videoCountByChannel[ch.channel_id] ?? 0,
    })),
  })
}
