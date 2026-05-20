import { NextResponse } from 'next/server'
import {
  buildInsights,
  extractTrendingKeywords,
} from '@/lib/analytics-from-videos'
import {
  getOutlierVideos,
  getVideoStats,
  getVideosForAnalytics,
  getChannels,
} from '@/lib/queries'

export async function GET() {
  const [videos, stats, outliers, channels] = await Promise.all([
    getVideosForAnalytics(200),
    getVideoStats(),
    getOutlierVideos(1.5, 5),
    getChannels('youtube'),
  ])

  const trending = extractTrendingKeywords(videos, 8)
  const topKeyword = trending[0]?.keyword

  const insights = buildInsights({
    totalVideos: stats.total,
    avgVsAvg: stats.avgVsAvg,
    outlierCount: outliers.length,
    channelCount: channels.length,
    topOutlier: outliers[0]
      ? {
          title: outliers[0].title,
          vs_avg: Number(outliers[0].vs_avg),
          channel_name: outliers[0].channel_name,
        }
      : undefined,
    topKeyword,
  })

  return NextResponse.json({ trending, insights })
}
