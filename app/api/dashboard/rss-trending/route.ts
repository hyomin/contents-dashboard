import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'
import { ALL_RSS_FEEDS } from '@/lib/data/rss-topic-collect'

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
}

export interface RssTrendingResponse {
  trending: TrendingTopic[]
  allTopics: TrendingTopic[]
  feedCategories: { category: string; feeds: string[] }[]
  totalFeeds: number
  activeFeeds: number
}

/** 카테고리별 피드 그룹 */
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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)
  const days = parseInt(searchParams.get('days') ?? '3')

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let queryResult = await supabase
    .from('rss_topic_candidates')
    .select('id, title, ai_title, ai_reason, sources, source_feed, relevance_score, collected_at, link')
    .gte('collected_at', since)
    .order('relevance_score', { ascending: false })
    .order('collected_at', { ascending: false })
    .limit(limit)

  // sources 컬럼이 아직 없는 경우 (migration 전) fallback
  if (queryResult.error?.message?.includes('sources')) {
    queryResult = await supabase
      .from('rss_topic_candidates')
      .select('id, title, ai_title, ai_reason, source_feed, relevance_score, collected_at, link')
      .gte('collected_at', since)
      .order('relevance_score', { ascending: false })
      .order('collected_at', { ascending: false })
      .limit(limit)
  }

  const { data, error } = queryResult
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as TrendingTopic[]

  const topics: TrendingTopic[] = rows.map((row) => {
    const sources: string[] = Array.isArray(row.sources) && row.sources.length > 0
      ? row.sources
      : [row.source_feed]
    const sourceCount = sources.length
    return {
      ...row,
      sources,
      sourceCount,
      // 2개 이상 피드에서 거론된 주제 = 급상승
      isTrending: sourceCount >= 2,
    }
  })

  // 급상승(2개 이상 소스) 우선, 그 다음 relevance_score 순
  const trending = topics
    .filter((t) => t.isTrending)
    .sort((a, b) => b.sourceCount - a.sourceCount || b.relevance_score - a.relevance_score)

  const activeFeedNames = new Set(rows.flatMap((r) => (Array.isArray(r.sources) ? r.sources : [r.source_feed])))

  return NextResponse.json({
    trending,
    allTopics: topics,
    feedCategories: buildFeedCategories(),
    totalFeeds: ALL_RSS_FEEDS.length,
    activeFeeds: activeFeedNames.size,
  } satisfies RssTrendingResponse)
}
