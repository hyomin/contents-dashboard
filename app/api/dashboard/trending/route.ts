import { NextResponse } from 'next/server'
import { getVideosForAnalytics } from '@/lib/data/queries'
import { extractTrendingByFormat } from '@/lib/data/analytics-from-videos'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'

export interface TrendingResponse {
  keywords: TrendingKeyword[]
  byFormat: {
    all: TrendingKeyword[]
    short: TrendingKeyword[]
    long: TrendingKeyword[]
  }
  cached: boolean
}

/** 캐시 키: `${period}-${channelIds}` */
const cache = new Map<string, { data: TrendingResponse; cachedAt: number }>()
const CACHE_TTL = 30 * 60 * 1000

function makeCacheKey(period: string, channelIds: string[]): string {
  return `${period}:${channelIds.sort().join(',')}`
}

/** period 값을 ISO from 날짜로 변환 */
function periodToFrom(period: string): string | undefined {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : undefined
  if (!days) return undefined
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bust = searchParams.has('bust')
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const period = searchParams.get('period') ?? 'all'
  const channelParam = searchParams.get('channels') ?? ''
  const channelIds = channelParam ? channelParam.split(',').filter(Boolean) : []

  const cacheKey = makeCacheKey(period, channelIds)

  if (!bust) {
    const hit = cache.get(cacheKey)
    if (hit && Date.now() - hit.cachedAt < CACHE_TTL) {
      const res: TrendingResponse = {
        ...hit.data,
        keywords: hit.data.byFormat.all.slice(0, limit),
        cached: true,
      }
      return NextResponse.json(res)
    }
  } else {
    cache.delete(cacheKey)
  }

  const from = periodToFrom(period)
  const videos = await getVideosForAnalytics(500, {
    from,
    channelIds: channelIds.length ? channelIds : undefined,
  })

  const byFormat = extractTrendingByFormat(videos, 20)

  const data: TrendingResponse = {
    keywords: byFormat.all.slice(0, limit),
    byFormat,
    cached: false,
  }

  cache.set(cacheKey, { data, cachedAt: Date.now() })
  return NextResponse.json(data)
}
