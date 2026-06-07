import { NextRequest, NextResponse } from 'next/server'

export interface YoutubeSearchItem {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  description: string
  viewCount: number | null
  likeCount: number | null
  duration: string
  url: string
  /** 채널 평균 조회수 대비 배율 (channels.list statistics 기반, 채널 정보 없으면 null) */
  vsAvg: number | null
}

export interface YoutubeSearchResult {
  keyword: string
  type: 'shorts' | 'video'
  items: YoutubeSearchItem[]
  cached?: boolean
}

/** ISO 8601 duration → 읽기 쉬운 포맷 (PT1M3S → 1:03) */
function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const h = parseInt(m[1] ?? '0')
  const min = parseInt(m[2] ?? '0')
  const sec = parseInt(m[3] ?? '0')
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${min}:${String(sec).padStart(2, '0')}`
}

/** 조회수 포맷 */
function fmtViews(n: number | null): string {
  if (n == null) return '-'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`
  return n.toLocaleString()
}

/** ISO 날짜 → YYYY.MM.DD */
function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '.')
}

// 5분 인메모리 캐시
const cache = new Map<string, { data: YoutubeSearchResult; expireAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const keyword = searchParams.get('keyword')?.trim()
  const type = searchParams.get('type') === 'video' ? 'video' : 'shorts'
  const display = Math.min(parseInt(searchParams.get('display') ?? '10', 10), 20)
  const rawOrder = searchParams.get('order')
  const order: 'relevance' | 'date' | 'viewCount' =
    rawOrder === 'date' ? 'date' : rawOrder === 'viewCount' ? 'viewCount' : 'relevance'

  if (!keyword) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다' }, { status: 500 })
  }

  const cacheKey = `${keyword}:${type}:${display}:${order}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  try {
    // Shorts: 짧은 동영상 + #shorts 키워드 조합
    const query = type === 'shorts' ? `${keyword} #shorts` : keyword

    // Step 1: Search API
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('key', apiKey)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('maxResults', String(display))
    // viewCount는 YouTube Search API가 지원하는 order 값
    searchUrl.searchParams.set('order', order)
    if (type === 'shorts') {
      searchUrl.searchParams.set('videoDuration', 'short')
    }

    const searchRes = await fetch(searchUrl.toString(), { next: { revalidate: 0 } })
    if (!searchRes.ok) {
      const text = await searchRes.text()
      console.error('[youtube-search] Search API 오류:', searchRes.status, text)
      return NextResponse.json({ error: `YouTube Search API 오류: ${searchRes.status}` }, { status: searchRes.status })
    }

    const searchData = (await searchRes.json()) as {
      items?: {
        id: { videoId: string }
        snippet: {
          title: string
          channelTitle: string
          channelId: string
          publishedAt: string
          description: string
          thumbnails: { medium?: { url: string }; default?: { url: string } }
        }
      }[]
    }

    const rawItems = searchData.items ?? []
    if (rawItems.length === 0) {
      const result: YoutubeSearchResult = { keyword, type, items: [] }
      cache.set(cacheKey, { data: result, expireAt: Date.now() + CACHE_TTL_MS })
      return NextResponse.json(result)
    }

    // Step 2: Videos API (통계 + 재생시간)
    const videoIds = rawItems.map(it => it.id.videoId).join(',')
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    videosUrl.searchParams.set('key', apiKey)
    videosUrl.searchParams.set('id', videoIds)
    videosUrl.searchParams.set('part', 'statistics,contentDetails')

    const videosRes = await fetch(videosUrl.toString(), { next: { revalidate: 0 } })
    const statsMap = new Map<string, { viewCount: number | null; likeCount: number | null; duration: string }>()

    if (videosRes.ok) {
      const videosData = (await videosRes.json()) as {
        items?: {
          id: string
          statistics?: { viewCount?: string; likeCount?: string }
          contentDetails?: { duration?: string }
        }[]
      }
      for (const v of videosData.items ?? []) {
        statsMap.set(v.id, {
          viewCount: v.statistics?.viewCount != null ? parseInt(v.statistics.viewCount) : null,
          likeCount: v.statistics?.likeCount != null ? parseInt(v.statistics.likeCount) : null,
          duration: parseDuration(v.contentDetails?.duration ?? ''),
        })
      }
    }

    // Step 3: Channels API (채널 평균 조회수 — vsAvg 계산용)
    // statistics.viewCount(채널 누적 조회수) ÷ statistics.videoCount(업로드 영상 수) ≈ 채널 평균 조회수
    const channelIds = [...new Set(rawItems.map(it => it.snippet.channelId).filter(Boolean))]
    const channelAvgMap = new Map<string, number>()

    if (channelIds.length > 0) {
      const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
      channelsUrl.searchParams.set('key', apiKey)
      channelsUrl.searchParams.set('id', channelIds.join(','))
      channelsUrl.searchParams.set('part', 'statistics')

      const channelsRes = await fetch(channelsUrl.toString(), { next: { revalidate: 0 } })
      if (channelsRes.ok) {
        const channelsData = (await channelsRes.json()) as {
          items?: { id: string; statistics?: { viewCount?: string; videoCount?: string } }[]
        }
        for (const c of channelsData.items ?? []) {
          const totalViews = c.statistics?.viewCount != null ? parseInt(c.statistics.viewCount) : 0
          const videoCount = c.statistics?.videoCount != null ? parseInt(c.statistics.videoCount) : 0
          if (totalViews > 0 && videoCount > 0) {
            channelAvgMap.set(c.id, totalViews / videoCount)
          }
        }
      }
    }

    const items: YoutubeSearchItem[] = rawItems.map(it => {
      const stats = statsMap.get(it.id.videoId)
      const channelAvg = channelAvgMap.get(it.snippet.channelId)
      const vsAvg =
        stats?.viewCount != null && channelAvg
          ? Number((stats.viewCount / channelAvg).toFixed(1))
          : null
      return {
        videoId: it.id.videoId,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        publishedAt: fmtDate(it.snippet.publishedAt),
        thumbnailUrl: it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? '',
        description: it.snippet.description.slice(0, 120),
        viewCount: stats?.viewCount ?? null,
        likeCount: stats?.likeCount ?? null,
        duration: stats?.duration ?? '',
        url: `https://www.youtube.com/shorts/${it.id.videoId}`,
        vsAvg,
      }
    })

    // 조회수순이거나 관련도순일 때 → 조회수 높은 순 정렬 (최신순 제외)
    if (order !== 'date') {
      items.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    }

    const result: YoutubeSearchResult = { keyword, type, items, cached: false }
    cache.set(cacheKey, { data: result, expireAt: Date.now() + CACHE_TTL_MS })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[youtube-search] 오류:', err)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}

/** 조회수 포맷 함수 (클라이언트에서 사용 가능하도록 export) */
export { fmtViews }
