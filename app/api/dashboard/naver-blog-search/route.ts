import { NextRequest, NextResponse } from 'next/server'

export interface NaverBlogSearchItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

export interface NaverBlogSearchResult {
  keyword: string
  total: number
  items: NaverBlogSearchItem[]
  cached?: boolean
}

/** HTML 태그·엔티티 제거 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#[0-9]+;/g, '')
    .trim()
}

/** postdate: YYYYMMDD → YYYY.MM.DD */
function formatPostDate(raw: string): string {
  if (!raw || raw.length !== 8) return raw
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`
}

/** URL에 프로토콜이 없으면 https:// 추가 */
function normalizeUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

// 간단한 인메모리 캐시 (5분)
const cache = new Map<string, { data: NaverBlogSearchResult; expireAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const keyword = searchParams.get('keyword')?.trim()
  const display = Math.min(parseInt(searchParams.get('display') ?? '10', 10), 20)
  const sort = searchParams.get('sort') === 'date' ? 'date' : 'sim'

  if (!keyword) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다' }, { status: 400 })
  }

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되어 있지 않습니다' },
      { status: 500 },
    )
  }

  const cacheKey = `${keyword}:${display}:${sort}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  const url = new URL('https://openapi.naver.com/v1/search/blog.json')
  url.searchParams.set('query', keyword)
  url.searchParams.set('display', String(display))
  url.searchParams.set('start', '1')
  url.searchParams.set('sort', sort)

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[naver-blog-search] API 오류:', res.status, text)
      return NextResponse.json(
        { error: `네이버 API 오류: ${res.status}`, detail: text },
        { status: res.status },
      )
    }

    const raw = (await res.json()) as {
      total?: number
      items?: {
        title: string
        link: string
        description: string
        bloggername: string
        bloggerlink: string
        postdate: string
      }[]
    }

    const items: NaverBlogSearchItem[] = (raw.items ?? []).map((it) => ({
      title: stripHtml(it.title),
      link: normalizeUrl(it.link),
      description: stripHtml(it.description),
      bloggername: it.bloggername,
      bloggerlink: normalizeUrl(it.bloggerlink),
      postdate: formatPostDate(it.postdate),
    }))

    const result: NaverBlogSearchResult = {
      keyword,
      total: raw.total ?? 0,
      items,
      cached: false,
    }

    cache.set(cacheKey, { data: result, expireAt: Date.now() + CACHE_TTL_MS })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[naver-blog-search] 요청 오류:', err)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
