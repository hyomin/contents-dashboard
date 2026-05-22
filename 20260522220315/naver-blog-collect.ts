import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getCollectMaxVideosPerChannel,
} from '@/lib/collect-config'
import {
  blogIdFromBloggerLink,
  parseNaverBlogId,
  postIdFromLink,
} from '@/lib/data/naver-blog-id'

/** 네이버 블로그용 기본 최대 수집 건수 (날짜 범위 없이 최신 N개) */
const NAVER_BLOG_DEFAULT_MAX_POSTS = 30

const NAVER_BLOG_SEARCH = 'https://openapi.naver.com/v1/search/blog.json'

interface NaverBlogItem {
  title?: string
  link?: string
  description?: string
  bloggername?: string
  bloggerlink?: string
  postdate?: string
}

interface NaverBlogSearchResponse {
  items?: NaverBlogItem[]
  errorCode?: string
  errorMessage?: string
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function clampInt(n: number) {
  return Math.min(Math.max(0, Math.round(n)), 2147483647)
}

function postdateToIso(postdate: string): string | null {
  if (!/^\d{8}$/.test(postdate)) return null
  const y = postdate.slice(0, 4)
  const m = postdate.slice(4, 6)
  const d = postdate.slice(6, 8)
  return `${y}-${m}-${d}T12:00:00.000Z`
}


export interface CollectNaverBlogChannelResult {
  ok: boolean
  channel_id: string
  channelName?: string
  postCount?: number
  maxPostsPerChannel?: number
  message?: string
  error?: string
}

async function fetchNaverBlogSearch(query: string, display: number): Promise<NaverBlogSearchResponse> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return { errorCode: 'ENV', errorMessage: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정' }
  }

  const url = `${NAVER_BLOG_SEARCH}?${new URLSearchParams({
    query,
    display: String(Math.min(Math.max(display, 1), 100)),
    start: '1',
    sort: 'date',
  })}`

  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    next: { revalidate: 0 },
  })

  const data = (await res.json()) as NaverBlogSearchResponse
  if (!res.ok && !data.errorCode) {
    return {
      errorCode: String(res.status),
      errorMessage: `Naver API HTTP ${res.status}`,
    }
  }
  return data
}

export async function collectNaverBlogChannelData(params: {
  channel_id: string
  channel_name?: string | null
  maxPosts?: number
}): Promise<CollectNaverBlogChannelResult> {
  const blogId = parseNaverBlogId(params.channel_id)
  if (!blogId) {
    return { ok: false, channel_id: params.channel_id, error: '유효한 네이버 블로그 ID가 아닙니다.' }
  }

  const maxPosts = params.maxPosts ?? Math.max(getCollectMaxVideosPerChannel(), NAVER_BLOG_DEFAULT_MAX_POSTS)

  // 네이버 블로그는 날짜 범위 없이 최신 N개를 수집 (유튜브와 달리 업로드 주기가 낮음)
  const fetchCount = Math.min(maxPosts * 3, 100)
  const search = await fetchNaverBlogSearch(blogId, fetchCount)
  if (search.errorCode) {
    return {
      ok: false,
      channel_id: blogId,
      error: search.errorMessage ?? `Naver API 오류 (${search.errorCode})`,
    }
  }

  const rawItems = search.items ?? []
  // bloggerlink 또는 link에서 blogId 추출해 매칭 (대소문자 무관)
  const matched = rawItems.filter((item) => {
    const fromLink = item.link ? blogIdFromBloggerLink(item.link) : null
    const fromBlogger = item.bloggerlink ? blogIdFromBloggerLink(item.bloggerlink) : null
    const owner = fromLink ?? fromBlogger
    if (owner && owner.toLowerCase() === blogId.toLowerCase()) return true
    return false
  })

  // 날짜 필터 없이 매칭된 글 전체 (최신순 N개)
  const inRange = matched

  const resolvedName =
    (params.channel_name && String(params.channel_name).trim()) ||
    inRange[0]?.bloggername ||
    blogId

  type PostRow = {
    platform: string
    video_id: string
    channel_id: string
    channel_name: string
    title: string
    thumbnail_url: string
    views: number
    likes: number
    comments: number
    duration: number
    format: string
    published_at: string | null
    avg_views: number
    vs_avg: number
    tier: string
    score: number
    scraped_at: string
  }

  const postRows: PostRow[] = inRange.slice(0, maxPosts).map((item) => {
    const link = item.link ?? ''
    const postId = postIdFromLink(link)
    const videoId = link || `naver-blog:${blogId}:${postId ?? Date.now()}`
    const title = stripHtml(item.title ?? '제목 없음').slice(0, 500)

    return {
      platform: 'naver-blog',
      video_id: videoId,
      channel_id: blogId,
      channel_name: resolvedName,
      title,
      thumbnail_url: '',
      views: 0,
      likes: 0,
      comments: 0,
      duration: 0,
      format: 'long',
      published_at: item.postdate ? postdateToIso(item.postdate) : null,
      avg_views: 0,
      vs_avg: 1,
      tier: 'C',
      score: 0,
      scraped_at: new Date().toISOString(),
    }
  })

  const channelRow = {
    channel_id: blogId,
    channel_name: resolvedName,
    platform: 'naver-blog',
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
    maxPostsPerChannel: maxPosts,
    message:
      postRows.length > 0
        ? `${resolvedName} 블로그 ${postRows.length}건 수집 (조회수는 별도 «조회수 갱신» 필요)`
        : `${resolvedName}: 검색 결과에서 blogId(${blogId})에 해당하는 글이 없습니다. 블로그 ID·검색 노출을 확인해 주세요.`,
  }
}
