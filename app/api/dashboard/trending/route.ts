import { NextResponse } from 'next/server'
import { getVideosForAnalytics } from '@/lib/data/queries'
import { extractTrendingKeywords } from '@/lib/data/analytics-from-videos'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'

/** 간단한 메모리 캐시 (30분) */
const cache: { data: { keywords: TrendingKeyword[]; cachedAt: number } | null } = { data: null }
const CACHE_TTL = 30 * 60 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bust = searchParams.has('bust')
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)

  if (!bust && cache.data && Date.now() - cache.data.cachedAt < CACHE_TTL) {
    return NextResponse.json({ keywords: cache.data.keywords.slice(0, limit), cached: true })
  }
  if (bust) cache.data = null

  const videos = await getVideosForAnalytics(500)
  const keywords = extractTrendingKeywords(videos, 20)

  cache.data = { keywords, cachedAt: Date.now() }
  return NextResponse.json({ keywords: keywords.slice(0, limit), cached: false })
}
