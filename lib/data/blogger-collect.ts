import { parseRssXml } from '@/lib/data/rss-topic-collect'
import { getCollectMaxVideosPerChannel } from '@/lib/dashboard/collect-config'
import { clampInt } from '@/lib/utils/number'
import { NAVER_USER_AGENT } from '@/lib/utils/http'
import { persistChannelAndVideos } from '@/lib/data/persist-helpers'

/**
 * Blogger 블로그 ID(호스트명) 정규화.
 * 입력 형태: "myblog.blogspot.com", "https://myblog.blogspot.com/", "myblog",
 *             "https://customdomain.com"
 * → 반환: "myblog.blogspot.com" 또는 "customdomain.com"
 */
export function parseBloggerBlogId(raw: string): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (!host) return null
    // "blogname" 만 입력했을 때 → blogname.blogspot.com
    if (!host.includes('.')) return `${host}.blogspot.com`
    return host
  } catch {
    const cleaned = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]?.trim().toLowerCase()
    if (!cleaned) return null
    if (!cleaned.includes('.')) return `${cleaned}.blogspot.com`
    return cleaned
  }
}

/** Blogger RSS URL 생성 */
function rssUrl(blogId: string): string {
  return `https://${blogId}/feeds/posts/default?alt=rss`
}

function pubDateToIso(pubDate?: string): string | null {
  if (!pubDate) return null
  const d = new Date(pubDate)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

export interface CollectBloggerChannelResult {
  ok: boolean
  channel_id: string
  channelName?: string
  postCount?: number
  message?: string
  error?: string
}

export async function collectBloggerChannelData(params: {
  channel_id: string
  channel_name?: string | null
}): Promise<CollectBloggerChannelResult> {
  const blogId = parseBloggerBlogId(params.channel_id)
  if (!blogId) {
    return { ok: false, channel_id: params.channel_id, error: '유효한 Blogger 블로그 주소가 아닙니다.' }
  }

  const maxPosts = getCollectMaxVideosPerChannel()
  const url = rssUrl(blogId)

  let rssText: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': NAVER_USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(14_000),
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      if (res.status === 404) {
        return {
          ok: false,
          channel_id: blogId,
          error: `${blogId} 블로그를 찾을 수 없습니다. 주소를 확인해 주세요.`,
        }
      }
      return {
        ok: false,
        channel_id: blogId,
        error: `RSS 수신 실패 (HTTP ${res.status})`,
      }
    }
    rssText = await res.text()
  } catch (e) {
    return {
      ok: false,
      channel_id: blogId,
      error: `RSS 요청 오류: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const items = parseRssXml(rssText)
  if (!items.length) {
    return {
      ok: false,
      channel_id: blogId,
      error: 'RSS 피드에 글이 없거나 비공개 블로그입니다.',
    }
  }

  const feedTitleMatch = rssText.match(/<channel[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i)
  const feedTitle = feedTitleMatch
    ? feedTitleMatch[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .trim()
    : blogId

  const resolvedName =
    (params.channel_name && String(params.channel_name).trim()) || feedTitle || blogId

  const postRows = items.slice(0, maxPosts).map((item) => ({
    platform: 'blogger',
    video_id: item.link || `blogger:${blogId}:${encodeURIComponent(item.title)}`,
    channel_id: blogId,
    channel_name: resolvedName,
    title: item.title.slice(0, 500),
    thumbnail_url: '',
    views: 0,
    likes: 0,
    comments: 0,
    duration: 0,
    format: 'long' as const,
    published_at: pubDateToIso(item.pubDate),
    avg_views: 0,
    vs_avg: 1,
    tier: 'C' as const,
    score: 0,
    scraped_at: new Date().toISOString(),
  }))

  const channelRow = {
    channel_id: blogId,
    channel_name: resolvedName,
    platform: 'blogger',
    subscribers: 0,
    total_views: 0,
    video_count: clampInt(postRows.length),
    avg_views: 0,
    updated_at: new Date().toISOString(),
  }

  const saveResult = await persistChannelAndVideos(channelRow, postRows)
  if (!saveResult.ok) {
    return { ok: false, channel_id: blogId, error: saveResult.error }
  }

  return {
    ok: true,
    channel_id: blogId,
    channelName: resolvedName,
    postCount: postRows.length,
    message: `${resolvedName} Blogger ${postRows.length}건 수집 (RSS · 조회수 미제공)`,
  }
}
