import { parseNaverBlogId, postIdFromLink } from '@/lib/data/naver-blog-id'
import { NAVER_USER_AGENT } from '@/lib/utils/http'

const USER_AGENT = NAVER_USER_AGENT

export type NaverBlogViewsSource = 'readCount' | 'html' | 'engagement' | 'none'

export interface NaverBlogPostMetrics {
  blogId: string
  logNo: string
  views: number
  likes: number
  comments: number
  viewsSource: NaverBlogViewsSource
}

export function logNoFromVideoId(videoId: string): string | null {
  const fromLink = postIdFromLink(videoId)
  if (fromLink) return fromLink
  const tail = videoId.match(/:(\d{8,})$/)?.[1]
  if (tail) return tail
  const path = videoId.match(/blog\.naver\.com\/[^/]+\/(\d+)/i)?.[1]
  return path ?? null
}

export function blogIdFromChannelOrVideo(channelId: string, videoId: string): string | null {
  const fromChannel = parseNaverBlogId(channelId)
  if (fromChannel) return fromChannel
  return parseNaverBlogId(videoId)
}

function parseCount(raw: string | undefined | null): number {
  if (raw == null || raw === '') return 0
  const n = parseInt(String(raw).replace(/,/g, ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

async function fetchText(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/json,*/*',
      ...(referer ? { Referer: referer } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** 글 목록 API — readCount·commentCount (블로그 설정에 따라 비어 있을 수 있음) */
export async function fetchNaverBlogTitleListMetricsMap(
  blogId: string,
  maxPages = 4,
): Promise<Map<string, { readCount: number; commentCount: number }>> {
  const map = new Map<string, { readCount: number; commentCount: number }>()
  const referer = `https://blog.naver.com/${blogId}`

  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}` +
      `&viewdate=&currentPage=${page}&categoryNo=0&countPerPage=30`
    let text: string
    try {
      text = await fetchText(url, referer)
    } catch {
      break
    }

    const re =
      /"logNo":"(\d+)"[\s\S]*?"readCount":"([^"]*)"[\s\S]*?"commentCount":"([^"]*)"/g
    let match: RegExpExecArray | null
    let pageHits = 0
    while ((match = re.exec(text)) !== null) {
      pageHits++
      map.set(match[1], {
        readCount: parseCount(match[2]),
        commentCount: parseCount(match[3]),
      })
    }
    if (pageHits === 0) break
  }

  return map
}

/** 공개 좋아요 수 (blog.like.naver.com) */
export async function fetchNaverBlogLikeCount(blogId: string, logNo: string): Promise<number> {
  const contentsId = `${blogId}_${logNo}`
  const url = `https://blog.like.naver.com/v1/services/BLOG/contents/${encodeURIComponent(contentsId)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Referer: `https://blog.naver.com/${blogId}/${logNo}`,
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return 0
  const data = (await res.json()) as {
    reactions?: Array<{ reactionType?: string; count?: number }>
  }
  const like = data.reactions?.find((r) => r.reactionType === 'like')
  return parseCount(String(like?.count ?? 0))
}

export function parseReadCountFromHtml(html: string): number | null {
  const patterns = [
    /"readCount"\s*:\s*"?(\d+)"?/i,
    /readCount\s*[=:]\s*['"]?(\d+)/i,
    /"postReadCount"\s*:\s*"?(\d+)"?/i,
    /조회\s*([\d,]+)/i,
    /"visitCount"\s*:\s*"?(\d+)"?/i,
  ]
  for (const pat of patterns) {
    const m = html.match(pat)
    if (m?.[1]) {
      const n = parseCount(m[1])
      if (n > 0) return n
    }
  }
  return null
}

export async function fetchNaverBlogPostMetrics(
  blogId: string,
  logNo: string,
  listMap?: Map<string, { readCount: number; commentCount: number }>,
): Promise<NaverBlogPostMetrics> {
  const listed = listMap?.get(logNo)
  let views = listed?.readCount ?? 0
  const comments = listed?.commentCount ?? 0
  let viewsSource: NaverBlogViewsSource = views > 0 ? 'readCount' : 'none'

  if (views <= 0) {
    try {
      const postUrl =
        `https://blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}` +
        `&logNo=${encodeURIComponent(logNo)}&redirect=Dlog&directAccess=false`
      const html = await fetchText(postUrl, `https://blog.naver.com/${blogId}`)
      const parsed = parseReadCountFromHtml(html)
      if (parsed != null && parsed > 0) {
        views = parsed
        viewsSource = 'html'
      }
    } catch {
      /* optional */
    }
  }

  let likes = 0
  try {
    likes = await fetchNaverBlogLikeCount(blogId, logNo)
  } catch {
    likes = 0
  }

  return {
    blogId,
    logNo,
    views,
    likes,
    comments,
    viewsSource,
  }
}

export function metricForVsAvg(
  metrics: Pick<NaverBlogPostMetrics, 'views' | 'likes' | 'comments'>,
  useEngagementFallback: boolean,
): { value: number; kind: 'views' | 'engagement' | 'none' } {
  if (metrics.views > 0) return { value: metrics.views, kind: 'views' }
  if (useEngagementFallback) {
    const engagement = metrics.likes + metrics.comments * 2
    if (engagement > 0) return { value: engagement, kind: 'engagement' }
  }
  return { value: 0, kind: 'none' }
}
