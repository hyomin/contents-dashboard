import { NextRequest, NextResponse } from 'next/server'

export interface TistorySearchItem {
  title: string
  link: string
  description: string
  blogId: string
  blogHome: string
}

export interface TistorySearchResult {
  keyword: string
  total: number
  items: TistorySearchItem[]
  cached?: boolean
}

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

/**
 * https://xxx.tistory.com/123 → { blogId: 'xxx', blogHome: 'https://xxx.tistory.com' }
 * https://xxx.tistory.com    → { blogId: 'xxx', blogHome: 'https://xxx.tistory.com' }
 */
function extractTistoryBlogInfo(url: string): { blogId: string; blogHome: string } {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.tistory\.com/i)
  if (match?.[1]) {
    const blogId = match[1]
    return { blogId, blogHome: `https://${blogId}.tistory.com` }
  }
  return { blogId: '', blogHome: '' }
}

// 인메모리 캐시 (5분)
const cache = new Map<string, { data: TistorySearchResult; expireAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const keyword = searchParams.get('keyword')?.trim()
  const display = Math.min(parseInt(searchParams.get('display') ?? '10', 10), 20)
  // webkr API는 sort 파라미터가 없으나, date 요청 시 쿼리에 최신 키워드를 붙여 활용
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

  // Naver 웹 검색 API에 site:tistory.com 필터 적용
  const query = `${keyword} site:tistory.com`
  const apiUrl = new URL('https://openapi.naver.com/v1/search/webkr.json')
  apiUrl.searchParams.set('query', query)
  apiUrl.searchParams.set('display', String(display))
  apiUrl.searchParams.set('start', '1')

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[tistory-search] Naver API 오류:', res.status, text)
      return NextResponse.json(
        { error: `네이버 웹 검색 API 오류: ${res.status}`, detail: text },
        { status: res.status },
      )
    }

    const raw = (await res.json()) as {
      total?: number
      items?: { title: string; link: string; description: string }[]
    }

    const allItems: TistorySearchItem[] = (raw.items ?? [])
      .map((it) => {
        const link = it.link
        const { blogId, blogHome } = extractTistoryBlogInfo(link)
        return {
          title: stripHtml(it.title),
          link,
          description: stripHtml(it.description),
          blogId,
          blogHome,
        }
      })
      // tistory.com 도메인 결과만 필터링
      .filter((it) => it.blogId !== '')

    const result: TistorySearchResult = {
      keyword,
      total: raw.total ?? allItems.length,
      items: allItems,
      cached: false,
    }

    cache.set(cacheKey, { data: result, expireAt: Date.now() + CACHE_TTL_MS })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[tistory-search] 요청 오류:', err)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
