import { NextRequest, NextResponse } from 'next/server'
import { getVideos, getOutlierVideos, getVideoStats } from '@/lib/queries'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'list'
  const platform = searchParams.get('platform') ?? undefined
  const limit = Number(searchParams.get('limit') ?? 50)
  const tier = searchParams.get('tier') ?? undefined

  if (type === 'stats') {
    const stats = await getVideoStats()
    return NextResponse.json(stats)
  }

  if (type === 'outliers') {
    const videos = await getOutlierVideos(1.5, limit)
    return NextResponse.json(videos)
  }

  const videos = await getVideos({ platform, limit, tier })
  return NextResponse.json(videos)
}
