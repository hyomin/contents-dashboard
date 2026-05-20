import { NextRequest, NextResponse } from 'next/server'
import { getVideos, getOutlierVideos, getVideoStats } from '@/lib/queries'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'list'
  const platform = searchParams.get('platform') ?? undefined
  const formatParam = searchParams.get('format') ?? undefined
  const format =
    formatParam === 'short' || formatParam === 'long' || formatParam === 'unknown'
      ? formatParam
      : undefined
  const limit = Number(searchParams.get('limit') ?? 50)
  const tier = searchParams.get('tier') ?? undefined

  if (type === 'stats') {
    const stats = await getVideoStats()
    return NextResponse.json(stats)
  }

  if (type === 'outliers') {
    const videos = await getOutlierVideos(1.5, limit, format)
    return NextResponse.json(videos)
  }

  if (type === 'tagged-outliers') {
    const { getTaggedOutlierVideos } = await import('@/lib/outlier-tagging')
    const minVsAvg = Number(searchParams.get('minVsAvg') ?? 0)
    const tagged = await getTaggedOutlierVideos(limit)
    const filtered =
      minVsAvg > 0 ? tagged.filter((t) => Number(t.vs_avg) >= minVsAvg) : tagged
    return NextResponse.json(filtered)
  }

  const videos = await getVideos({ platform, format, limit, tier })
  return NextResponse.json(videos)
}
