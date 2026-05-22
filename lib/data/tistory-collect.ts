import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseRssXml } from '@/lib/data/rss-topic-collect'
import { getCollectMaxVideosPerChannel } from '@/lib/collect-config'

/** 티스토리 블로그 ID에서 RSS URL 생성 */
function rssUrl(blogId: string): string {
  // blog.tistory.com 형태 또는 blogId.tistory.com 형태 처리
  const id = blogId.replace(/\.tistory\.com.*$/, '').trim()
  return `https://${id}.tistory.com/rss`
}

/** 티스토리 blogId 정규화 */
export function parseTistoryBlogId(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // URL 형태: https://jaetech.tistory.com/123 → jaetech
  const fromUrl = s.match(/https?:\/\/([a-z0-9-]+)\.tistory\.com/i)?.[1]
  if (fromUrl) return fromUrl.toLowerCase()
  // ID만 입력: jaetech
  if (/^[a-z0-9-]+$/i.test(s)) return s.toLowerCase()
  return null
}

function pubDateToIso(pubDate?: string): string | null {
  if (!pubDate) return null
  const d = new Date(pubDate)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function clampInt(n: number): number {
  return Math.min(Math.max(0, Math.round(n)), 2147483647)
}

export interface CollectTistoryChannelResult {
  ok: boolean
  channel_id: string
  channelName?: string
  postCount?: number
  message?: string
  error?: string
}

export async function collectTistoryChannelData(params: {
  channel_id: string
  channel_name?: string | null
}): Promise<CollectTistoryChannelResult> {
  const blogId = parseTistoryBlogId(params.channel_id)
  if (!blogId) {
    return { ok: false, channel_id: params.channel_id, error: '유효한 티스토리 블로그 ID가 아닙니다.' }
  }

  const maxPosts = getCollectMaxVideosPerChannel()
  const url = rssUrl(blogId)

  let rssText: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 0 },
    })
    if (!res.ok) {
      if (res.status === 404) {
        return {
          ok: false,
          channel_id: blogId,
          error: `${blogId}.tistory.com 을 찾을 수 없습니다. 블로그 ID를 확인해 주세요.`,
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
      error: `RSS 피드에 글이 없거나 비공개 블로그입니다.`,
    }
  }

  // RSS 채널 제목 추출 (<channel><title>…)
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
    platform: 'tistory',
    video_id: item.link || `tistory:${blogId}:${encodeURIComponent(item.title)}`,
    channel_id: blogId,
    channel_name: resolvedName,
    title: item.title.slice(0, 500),
    thumbnail_url: '',
    views: 0,
    likes: 0,
    comments: 0,
    duration: 0,
    format: 'long',
    published_at: pubDateToIso(item.pubDate),
    avg_views: 0,
    vs_avg: 1,
    tier: 'C',
    score: 0,
    scraped_at: new Date().toISOString(),
  }))

  const channelRow = {
    channel_id: blogId,
    channel_name: resolvedName,
    platform: 'tistory',
    subscribers: 0,
    total_views: 0,
    video_count: clampInt(postRows.length),
    avg_views: 0,
    updated_at: new Date().toISOString(),
  }

  const { error: chErr } = await supabaseAdmin
    .from('channels')
    .upsert(channelRow, { onConflict: 'channel_id' })
  if (chErr) {
    return { ok: false, channel_id: blogId, error: `채널 저장 실패: ${chErr.message}` }
  }

  if (postRows.length > 0) {
    const { error: postErr } = await supabaseAdmin
      .from('videos')
      .upsert(postRows, { onConflict: 'video_id' })
    if (postErr) {
      return { ok: false, channel_id: blogId, error: `글 저장 실패: ${postErr.message}` }
    }
  }

  return {
    ok: true,
    channel_id: blogId,
    channelName: resolvedName,
    postCount: postRows.length,
    message: `${resolvedName} 티스토리 ${postRows.length}건 수집 (RSS · 조회수 미제공)`,
  }
}
