import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'
import { ALL_RSS_FEEDS, FEED_CATEGORY_MAP, type RssFeedCategory } from '@/lib/data/rss-topic-collect'

export interface TrendingTopic {
  id: string
  title: string
  ai_title: string | null
  ai_reason: string | null
  sources: string[]
  source_feed: string
  relevance_score: number
  collected_at: string
  link: string | null
  sourceCount: number
  isTrending: boolean
  /** sources 배열에서 파생된 카테고리 목록 */
  categories: string[]
}

export interface CategoryStat {
  category: string
  count: number
  trendingCount: number
}

export interface RssTrendingResponse {
  trending: TrendingTopic[]
  allTopics: TrendingTopic[]
  feedCategories: { category: string; feeds: string[] }[]
  categoryStats: CategoryStat[]
  totalFeeds: number
  activeFeeds: number
}

/** 카테고리별 피드 그룹 (정의된 순서 유지) */
function buildFeedCategories() {
  const map = new Map<string, string[]>()
  for (const f of ALL_RSS_FEEDS) {
    if (!map.has(f.category)) map.set(f.category, [])
    map.get(f.category)!.push(f.name)
  }
  return Array.from(map.entries()).map(([category, feeds]) => ({ category, feeds }))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const days = parseInt(searchParams.get('days') ?? '7')
  const filterCategory = searchParams.get('category') // e.g. "IT·테크"

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  type RssRow = {
    id: string; title: string; ai_title: string | null; ai_reason: string | null
    sources?: unknown; source_feed: string; relevance_score: number
    collected_at: string; link: string | null
  }

  const r1 = await supabase
    .from('rss_topic_candidates')
    .select('id, title, ai_title, ai_reason, sources, source_feed, relevance_score, collected_at, link')
    .gte('collected_at', since)
    .order('relevance_score', { ascending: false })
    .order('collected_at', { ascending: false })
    .limit(limit)

  let data: RssRow[] | null
  let error: { message: string } | null

  // sources 컬럼이 아직 없는 경우 (migration 전) fallback
  if (r1.error?.message?.includes('sources')) {
    const r2 = await supabase
      .from('rss_topic_candidates')
      .select('id, title, ai_title, ai_reason, source_feed, relevance_score, collected_at, link')
      .gte('collected_at', since)
      .order('relevance_score', { ascending: false })
      .order('collected_at', { ascending: false })
      .limit(limit)
    data = r2.data as RssRow[] | null
    error = r2.error
  } else {
    data = r1.data as RssRow[] | null
    error = r1.error
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as (TrendingTopic & { sources?: unknown })[]

  const topics: TrendingTopic[] = rows.map((row) => {
    const sources: string[] = Array.isArray(row.sources) && row.sources.length > 0
      ? (row.sources as string[])
      : [row.source_feed]
    const sourceCount = sources.length

    // sources 배열의 피드 이름으로 카테고리 추론
    const categories = Array.from(new Set(
      sources
        .map((s) => FEED_CATEGORY_MAP.get(s))
        .filter((c): c is RssFeedCategory => c !== undefined)
    ))

    return {
      ...row,
      sources,
      sourceCount,
      categories,
      isTrending: sourceCount >= 2,
    }
  })

  // 카테고리 필터 적용
  const filtered = filterCategory
    ? topics.filter((t) =>
        t.categories.includes(filterCategory) ||
        FEED_CATEGORY_MAP.get(t.source_feed) === filterCategory
      )
    : topics

  const trending = filtered
    .filter((t) => t.isTrending)
    .sort((a, b) => b.sourceCount - a.sourceCount || b.relevance_score - a.relevance_score)

  // 카테고리별 통계
  const catMap = new Map<string, CategoryStat>()
  for (const t of topics) {
    for (const cat of t.categories.length > 0 ? t.categories : [FEED_CATEGORY_MAP.get(t.source_feed) ?? '기타']) {
      if (!catMap.has(cat)) catMap.set(cat, { category: cat, count: 0, trendingCount: 0 })
      const s = catMap.get(cat)!
      s.count++
      if (t.isTrending) s.trendingCount++
    }
  }
  const categoryStats = Array.from(catMap.values()).sort((a, b) => b.count - a.count)

  const activeFeedNames = new Set(rows.flatMap((r) =>
    Array.isArray(r.sources) ? (r.sources as string[]) : [r.source_feed]
  ))

  return NextResponse.json({
    trending,
    allTopics: filtered,
    feedCategories: buildFeedCategories(),
    categoryStats,
    totalFeeds: ALL_RSS_FEEDS.length,
    activeFeeds: activeFeedNames.size,
  } satisfies RssTrendingResponse)
}
