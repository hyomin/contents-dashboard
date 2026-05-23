import { supabaseAdmin } from '@/lib/data/supabase-admin'
import {
  getCollectMaxVideosPerChannel,
} from '@/lib/dashboard/collect-config'
import {
  blogIdFromBloggerLink,
  parseNaverBlogId,
  postIdFromLink,
} from '@/lib/data/naver-blog-id'

/** 네이버 블로그용 기본 최대 수집 건수 (날짜 범위 없이 최신 N개) */
const NAVER_BLOG_DEFAULT_MAX_POSTS = 30

/** PostTitleListAsync API로 블로그 글 목록 직접 수집 (검색 API 폴백) */
interface PostTitleItem {
  logNo: string
  title: string
  addDate?: string
}

async function fetchPostTitleList(blogId: string, maxPosts: number): Promise<PostTitleItem[]> {
  const maxPages = Math.ceil(maxPosts / 30)
  const items: PostTitleItem[] = []
  const referer = `https://blog.naver.com/${blogId}`

  for (let page = 1; page <= maxPages && items.length < maxPosts; page++) {
    const url =
      `https://blog.naver.com/PostTitleListAsync.naver?blogId=${encodeURIComponent(blogId)}` +
      `&viewdate=&currentPage=${page}&categoryNo=0&countPerPage=30`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          Referer: referer,
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) break
      const text = await res.text()

      // Naver PostTitleListAsync 응답이 이스케이프되지 않은 특수문자를 포함해 JSON.parse 실패 가능
      // → logNo/title만 정규식으로 추출하는 폴백 사용
      let pageItems: PostTitleItem[] = []
      try {
        const json = JSON.parse(text.trim())
        pageItems = (json.postList ?? []).map((p: Record<string, unknown>) => {
          let rawTitle = String(p.title ?? '제목 없음')
          try { rawTitle = decodeURIComponent(rawTitle.replace(/\+/g, ' ')) } catch { /* keep */ }
          rawTitle = rawTitle.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
          return {
            logNo: String(p.logNo ?? ''),
            title: rawTitle || '제목 없음',
            addDate: typeof p.addDate === 'string' ? p.addDate : undefined,
          }
        })
      } catch {
        // JSON 파싱 실패 → 정규식으로 logNo, title 추출
        const logNos = [...text.matchAll(/"logNo":"(\d+)"/g)].map((m) => m[1])
        const titles = [...text.matchAll(/"title":"([^"]*)"/g)].map((m) => {
          let t = m[1]
          try { t = decodeURIComponent(t.replace(/\+/g, ' ')) } catch { /* keep */ }
          return t.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() || '제목 없음'
        })
        const addDates = [...text.matchAll(/"addDate":"([^"]*)"/g)].map((m) => m[1])
        pageItems = logNos.map((logNo, i) => ({
          logNo,
          title: titles[i] ?? '제목 없음',
          addDate: addDates[i],
        }))
      }

      if (pageItems.length === 0) break
      items.push(...pageItems)
    } catch {
      break
    }
  }
  return items.slice(0, maxPosts)
}

function postTitleAddDateToIso(addDate?: string): string | null {
  if (!addDate) return null
  // 형식: "2025. 6. 7. 14:23" 또는 "2025.06.07 14:23"
  const m = addDate.match(/(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/)
  if (!m) return null
  const y = m[1], mo = m[2].padStart(2, '0'), d = m[3].padStart(2, '0')
  return `${y}-${mo}-${d}T12:00:00.000Z`
}

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

  const now = new Date().toISOString()

  // PostTitleListAsync를 우선 사용 (더 완전한 목록, 검색 노출 여부 무관)
  // 검색 API 결과가 더 많으면 병합
  const titleItems = await fetchPostTitleList(blogId, maxPosts)

  // 검색 결과 → video_id Set (중복 방지용)
  const searchLinks = new Set(inRange.map((it) => it.link ?? '').filter(Boolean))

  let postRows: PostRow[]

  if (titleItems.length >= inRange.length) {
    // PostTitleListAsync가 더 완전 → 우선 사용
    postRows = titleItems.map((item) => ({
      platform: 'naver-blog',
      video_id: `https://blog.naver.com/${blogId}/${item.logNo}`,
      channel_id: blogId,
      channel_name: resolvedName,
      title: item.title.slice(0, 500),
      thumbnail_url: '',
      views: 0,
      likes: 0,
      comments: 0,
      duration: 0,
      format: 'long',
      published_at: postTitleAddDateToIso(item.addDate),
      avg_views: 0,
      vs_avg: 1,
      tier: 'C',
      score: 0,
      scraped_at: now,
    }))
  } else {
    // 검색 API 결과 사용 + PostTitleListAsync 보충
    const titleVideoIds = new Set(titleItems.map((it) => `https://blog.naver.com/${blogId}/${it.logNo}`))
    postRows = [
      ...inRange.slice(0, maxPosts).map((item) => {
        const link = item.link ?? ''
        const postId = postIdFromLink(link)
        const videoId = link || `naver-blog:${blogId}:${postId ?? Date.now()}`
        return {
          platform: 'naver-blog',
          video_id: videoId,
          channel_id: blogId,
          channel_name: resolvedName,
          title: stripHtml(item.title ?? '제목 없음').slice(0, 500),
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
          scraped_at: now,
        }
      }),
      // 검색에 없는 글을 PostTitleListAsync로 보충
      ...titleItems
        .filter((it) => !searchLinks.has(`https://blog.naver.com/${blogId}/${it.logNo}`))
        .map((item) => ({
          platform: 'naver-blog',
          video_id: `https://blog.naver.com/${blogId}/${item.logNo}`,
          channel_id: blogId,
          channel_name: resolvedName,
          title: item.title.slice(0, 500),
          thumbnail_url: '',
          views: 0,
          likes: 0,
          comments: 0,
          duration: 0,
          format: 'long',
          published_at: postTitleAddDateToIso(item.addDate),
          avg_views: 0,
          vs_avg: 1,
          tier: 'C',
          score: 0,
          scraped_at: now,
        }))
        .filter((row) => !titleVideoIds.has(row.video_id)),
    ].slice(0, maxPosts)
  }

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
        ? `${resolvedName} 블로그 ${postRows.length}건 수집`
        : `${resolvedName}: 글 목록을 가져올 수 없습니다. 비공개 블로그이거나 게시글이 없을 수 있습니다.`,
  }
}
