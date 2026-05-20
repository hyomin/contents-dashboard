import { NextResponse } from 'next/server'
import {
  channelDisplayTier,
  extractTopKeyword,
} from '@/lib/analytics-from-videos'
import {
  getBestVsAvgByChannel,
  getChannelVideoTitles,
  getChannels,
  getVideoCountByChannel,
} from '@/lib/queries'

export async function GET() {
  const [channels, titlesByChannel, bestVsAvg, videoCounts] = await Promise.all([
    getChannels('youtube'),
    getChannelVideoTitles(),
    getBestVsAvgByChannel(),
    getVideoCountByChannel(),
  ])

  const enriched = channels.map((ch) => {
    const titles = titlesByChannel[ch.channel_id] ?? []
    const best = bestVsAvg[ch.channel_id] ?? 0
    return {
      id: ch.id,
      channel_id: ch.channel_id,
      name: ch.channel_name,
      platform: ch.platform,
      subs: ch.subscribers ?? 0,
      avgViews: ch.avg_views ?? 0,
      videos: videoCounts[ch.channel_id] ?? ch.video_count ?? 0,
      topKeyword: extractTopKeyword(titles),
      tier: channelDisplayTier(ch, best),
      updated_at: ch.updated_at,
    }
  })

  return NextResponse.json(enriched)
}
