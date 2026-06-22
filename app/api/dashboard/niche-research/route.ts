import { NextRequest, NextResponse } from 'next/server'

// 2시간 캐시 — 니치 탐색은 실시간성보다 quota 절약이 우선
const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const searchCache = new Map<string, { data: NicheResearchResult; expireAt: number }>()

export interface NicheResearchItem {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
  viewCount: number | null
  likeCount: number | null
  duration: string
  vsAvg: number | null
  subscriberCount: number | null // 채널 구독자 수
  url: string
}

export interface NicheResearchResult {
  keyword: string
  type: 'shorts' | 'video'
  items: NicheResearchItem[]
  insight: string | null
  subNiches: string[] // AI 추천 서브니치 키워드
  cached: boolean
  cachedAt: string
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const h = parseInt(m[1] ?? '0')
  const min = parseInt(m[2] ?? '0')
  const sec = parseInt(m[3] ?? '0')
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${min}:${String(sec).padStart(2, '0')}`
}

interface GeminiAnalysis {
  insight: string
  subNiches: string[]
}

async function buildNicheInsight(
  titles: string[],
  keyword: string,
): Promise<GeminiAnalysis> {
  const empty: GeminiAnalysis = { insight: '', subNiches: [] }
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || titles.length === 0) return empty

  const list = titles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')
  const prompt = `유튜브 "${keyword}" 검색 상위 영상 제목 목록입니다.

${list}

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "insight": "제목 구조·후킹 방식·키워드 특징·포맷 전략을 처음 진입하는 콘텐츠 기획자가 바로 적용할 수 있도록 3~4문장으로 분석 (한국어, 마크다운 없이)",
  "subNiches": ["${keyword}와 연관된 탐색 가치 있는 서브니치 키워드 1", "키워드 2", "키워드 3", "키워드 4", "키워드 5"]
}

subNiches는 현재 키워드보다 더 구체적이거나 인접한 서브카테고리 5개, 한국어 짧게.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    )
    if (!res.ok) return empty
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<GeminiAnalysis>
    return {
      insight: parsed.insight ?? '',
      subNiches: Array.isArray(parsed.subNiches) ? parsed.subNiches.slice(0, 5) : [],
    }
  } catch {
    return empty
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const keyword = searchParams.get('keyword')?.trim()
  const type = searchParams.get('type') === 'video' ? 'video' : 'shorts'
  const display = Math.min(parseInt(searchParams.get('display') ?? '20', 10), 25)

  if (!keyword) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY가 설정되지 않았습니다' }, { status: 500 })
  }

  const cacheKey = `${keyword}:${type}:${display}`
  const hit = searchCache.get(cacheKey)
  if (hit && hit.expireAt > Date.now()) {
    return NextResponse.json({ ...hit.data, cached: true })
  }

  try {
    // Step 1: YouTube Search (조회수 높은 순)
    const query = type === 'shorts' ? `${keyword} #shorts` : keyword
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('key', apiKey)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('maxResults', String(display))
    searchUrl.searchParams.set('order', 'viewCount')
    if (type === 'shorts') searchUrl.searchParams.set('videoDuration', 'short')
    // 롱폼은 4분 이상(medium)만 — Shorts가 viewCount 상위에 올라오는 현상 방지
    if (type === 'video') searchUrl.searchParams.set('videoDuration', 'medium')

    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) {
      const text = await searchRes.text()
      console.error('[niche-research] YouTube Search 오류:', searchRes.status, text)
      return NextResponse.json({ error: `YouTube Search 오류: ${searchRes.status}` }, { status: 502 })
    }

    const searchData = (await searchRes.json()) as {
      items?: {
        id: { videoId: string }
        snippet: {
          title: string
          channelTitle: string
          channelId: string
          publishedAt: string
          thumbnails: { medium?: { url: string }; default?: { url: string } }
        }
      }[]
    }

    const rawItems = searchData.items ?? []
    if (rawItems.length === 0) {
      const result: NicheResearchResult = {
        keyword, type, items: [], insight: null, subNiches: [], cached: false,
        cachedAt: new Date().toISOString(),
      }
      searchCache.set(cacheKey, { data: result, expireAt: Date.now() + CACHE_TTL_MS })
      return NextResponse.json(result)
    }

    // Step 2 & 3: 영상 통계 + 채널 통계 병렬 요청
    const videoIds = rawItems.map(it => it.id.videoId).join(',')
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    videosUrl.searchParams.set('key', apiKey)
    videosUrl.searchParams.set('id', videoIds)
    videosUrl.searchParams.set('part', 'statistics,contentDetails')

    const channelIds = [...new Set(rawItems.map(it => it.snippet.channelId).filter(Boolean))]
    const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
    channelsUrl.searchParams.set('key', apiKey)
    channelsUrl.searchParams.set('id', channelIds.join(','))
    channelsUrl.searchParams.set('part', 'statistics')

    const [videosRes, chRes] = await Promise.all([
      fetch(videosUrl.toString()),
      channelIds.length > 0 ? fetch(channelsUrl.toString()) : Promise.resolve(null),
    ])

    const statsMap = new Map<string, { viewCount: number | null; likeCount: number | null; duration: string }>()
    if (videosRes.ok) {
      const vd = (await videosRes.json()) as {
        items?: {
          id: string
          statistics?: { viewCount?: string; likeCount?: string }
          contentDetails?: { duration?: string }
        }[]
      }
      for (const v of vd.items ?? []) {
        statsMap.set(v.id, {
          viewCount: v.statistics?.viewCount != null ? parseInt(v.statistics.viewCount) : null,
          likeCount: v.statistics?.likeCount != null ? parseInt(v.statistics.likeCount) : null,
          duration: parseDuration(v.contentDetails?.duration ?? ''),
        })
      }
    }

    const channelMap = new Map<string, { avg: number; subscribers: number | null }>()
    if (chRes?.ok) {
      const cd = (await chRes.json()) as {
        items?: {
          id: string
          statistics?: {
            viewCount?: string
            videoCount?: string
            subscriberCount?: string
            hiddenSubscriberCount?: boolean
          }
        }[]
      }
      for (const c of cd.items ?? []) {
        const tv = c.statistics?.viewCount != null ? parseInt(c.statistics.viewCount) : 0
        const vc = c.statistics?.videoCount != null ? parseInt(c.statistics.videoCount) : 0
        const sub = c.statistics?.hiddenSubscriberCount
          ? null
          : c.statistics?.subscriberCount != null
            ? parseInt(c.statistics.subscriberCount)
            : null
        channelMap.set(c.id, {
          avg: tv > 0 && vc > 0 ? tv / vc : 0,
          subscribers: sub,
        })
      }
    }

    const items: NicheResearchItem[] = rawItems
      .map(it => {
        const stats = statsMap.get(it.id.videoId)
        const ch = channelMap.get(it.snippet.channelId)
        const vsAvg =
          stats?.viewCount != null && ch?.avg
            ? Number((stats.viewCount / ch.avg).toFixed(1))
            : null
        return {
          videoId: it.id.videoId,
          title: it.snippet.title,
          channelTitle: it.snippet.channelTitle,
          publishedAt: it.snippet.publishedAt.slice(0, 10).replace(/-/g, '.'),
          thumbnailUrl:
            it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? '',
          viewCount: stats?.viewCount ?? null,
          likeCount: stats?.likeCount ?? null,
          duration: stats?.duration ?? '',
          vsAvg,
          subscriberCount: ch?.subscribers ?? null,
          url:
            type === 'shorts'
              ? `https://www.youtube.com/shorts/${it.id.videoId}`
              : `https://www.youtube.com/watch?v=${it.id.videoId}`,
        }
      })
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))

    // Step 4: Gemini 니치 패턴 분석 + 서브니치 추천
    const { insight, subNiches } = await buildNicheInsight(
      items.slice(0, 15).map(it => it.title),
      keyword,
    )

    const result: NicheResearchResult = {
      keyword, type, items,
      insight: insight || null,
      subNiches,
      cached: false,
      cachedAt: new Date().toISOString(),
    }
    searchCache.set(cacheKey, { data: result, expireAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[niche-research] 오류:', err)
    return NextResponse.json({ error: '니치 탐색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
