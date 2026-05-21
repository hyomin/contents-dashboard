import { createHash } from 'crypto'
import { supabase } from './supabase'

export interface RssFeedConfig {
  name: string
  url: string
}

export interface RssTopicCandidateRow {
  id: string
  title: string
  link: string | null
  source_feed: string
  summary: string | null
  published_at: string | null
  relevance_score: number
  target_audience: string
  collected_at: string
  source: string
  updated_at: string
}

export interface RssTopicCollectResult {
  ok: boolean
  targetAudience: string
  feedCount: number
  parsedCount: number
  savedCount: number
  preview?: boolean
  topics: RssTopicCandidateRow[]
  message: string
  aiEnhanced?: boolean
}

/** 시니어·재테크 관련 기본 RSS (수집 실패 시 다음 피드로 진행) */
export const DEFAULT_RSS_FEEDS: RssFeedConfig[] = [
  { name: '동아일보', url: 'https://rss.donga.com/total.xml' },
  { name: '경향신문', url: 'https://www.khan.co.kr/rss/rssdata/total_news.xml' },
  { name: '이데일리', url: 'https://rss.etoday.co.kr/eto/pol_opi.xml' },
]

const AUDIENCE_KEYWORDS: Record<string, string[]> = {
  시니어: [
    '연금',
    '재테크',
    '은퇴',
    '노후',
    '시니어',
    '실버',
    '건강',
    '국민연금',
    '전세',
    '금리',
    '복지',
    '상속',
    '부동산',
    '투자',
    '절약',
    '노인',
    '요양',
    '의료',
  ],
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m ? decodeXmlEntities(m[1].replace(/<[^>]+>/g, ' ').trim()) : ''
}

export function parseRssXml(xml: string): {
  title: string
  link: string
  pubDate?: string
  description?: string
}[] {
  const items: { title: string; link: string; pubDate?: string; description?: string }[] = []
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link') || extractTag(block, 'guid')
    if (!title) continue
    items.push({
      title: title.slice(0, 500),
      link: link.slice(0, 2000) || '',
      pubDate: extractTag(block, 'pubDate') || extractTag(block, 'published'),
      description: extractTag(block, 'description').slice(0, 1000),
    })
  }
  return items
}

function topicId(link: string, title: string): string {
  const raw = link || title
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function scoreTitle(title: string, description: string, keywords: string[]): number {
  const text = `${title} ${description}`.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) score += title.includes(kw) ? 12 : 4
  }
  return score
}

async function fetchFeed(feed: RssFeedConfig): Promise<
  { feed: RssFeedConfig; items: ReturnType<typeof parseRssXml> } | null
> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'ContentsDashboard/1.0' },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const xml = await res.text()
    const items = parseRssXml(xml)
    if (!items.length) return null
    return { feed, items }
  } catch (err) {
    console.error('[rss-topic] feed failed', feed.name, err)
    return null
  }
}

async function refineWithAi(
  titles: string[],
  targetAudience: string,
  maxTopics: number,
): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey || titles.length === 0) return null

  const prompt = `다음 뉴스 제목 목록에서 ${targetAudience} 타겟 유튜브·블로그 콘텐츠 주제 후보 ${maxTopics}개를 한국어로 골라 주세요.
각 줄에 주제 한 줄만 출력하세요. 번호·불릿 없이 주제 문장만 ${maxTopics}줄.

제목 목록:
${titles.slice(0, 30).map((t, i) => `${i + 1}. ${t}`).join('\n')}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[]
    }
    const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[\d.)\-\s]+/, '').trim())
      .filter((l) => l.length > 8)
    return lines.slice(0, maxTopics)
  } catch (err) {
    console.error('[rss-topic] anthropic failed', err)
    return null
  }
}

export async function getRssTopicCandidates(limit = 30): Promise<RssTopicCandidateRow[]> {
  const { data, error } = await supabase
    .from('rss_topic_candidates')
    .select('*')
    .order('relevance_score', { ascending: false })
    .order('collected_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRssTopicCandidates error:', error)
    return []
  }
  return (data ?? []) as RssTopicCandidateRow[]
}

export async function runRssTopicCollect(options?: {
  targetAudience?: string
  maxTopics?: number
  persistCollected?: boolean
  feeds?: RssFeedConfig[]
  source?: string
  useAi?: boolean
}): Promise<RssTopicCollectResult> {
  const targetAudience = options?.targetAudience ?? '시니어'
  const maxTopics = Math.min(Math.max(options?.maxTopics ?? 5, 1), 20)
  const persistCollected = options?.persistCollected ?? true
  const feeds = options?.feeds?.length ? options.feeds : DEFAULT_RSS_FEEDS
  const source = options?.source ?? 'dashboard'
  const keywords = AUDIENCE_KEYWORDS[targetAudience] ?? AUDIENCE_KEYWORDS.시니어

  const feedResults = await Promise.all(feeds.map(fetchFeed))
  const okFeeds = feedResults.filter(Boolean) as NonNullable<
    (typeof feedResults)[number]
  >[]

  if (!okFeeds.length) {
    return {
      ok: false,
      targetAudience,
      feedCount: feeds.length,
      parsedCount: 0,
      savedCount: 0,
      topics: [],
      message: 'RSS 피드를 가져오지 못했습니다. 네트워크·피드 URL을 확인하세요.',
    }
  }

  type Scored = {
    title: string
    link: string | null
    source_feed: string
    summary: string | null
    published_at: string | null
    relevance_score: number
  }

  const scored: Scored[] = []
  for (const { feed, items } of okFeeds) {
    for (const item of items) {
      const relevance_score = scoreTitle(item.title, item.description ?? '', keywords)
      if (relevance_score <= 0) continue
      scored.push({
        title: item.title,
        link: item.link || null,
        source_feed: feed.name,
        summary: item.description ?? null,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        relevance_score,
      })
    }
  }

  scored.sort((a, b) => b.relevance_score - a.relevance_score)
  let top = scored.slice(0, maxTopics * 3)

  let aiEnhanced = false
  if (options?.useAi !== false && process.env.ANTHROPIC_API_KEY) {
    const aiLines = await refineWithAi(
      top.map((t) => t.title),
      targetAudience,
      maxTopics,
    )
    if (aiLines?.length) {
      aiEnhanced = true
      const matched = new Set<number>()
      const aiOrdered: Scored[] = []
      for (const line of aiLines) {
        const idx = top.findIndex(
          (t, i) => !matched.has(i) && (t.title.includes(line.slice(0, 12)) || line.includes(t.title.slice(0, 12))),
        )
        if (idx >= 0) {
          matched.add(idx)
          aiOrdered.push({ ...top[idx], title: line, relevance_score: top[idx].relevance_score + 50 })
        } else {
          aiOrdered.push({
            title: line,
            link: null,
            source_feed: 'AI 추천',
            summary: `${targetAudience} 타겟 주제 후보 (Claude)`,
            published_at: null,
            relevance_score: 80,
          })
        }
      }
      for (let i = 0; i < top.length && aiOrdered.length < maxTopics; i++) {
        if (!matched.has(i)) aiOrdered.push(top[i])
      }
      top = aiOrdered.slice(0, maxTopics)
    } else {
      top = top.slice(0, maxTopics)
    }
  } else {
    top = top.slice(0, maxTopics)
  }

  const now = new Date().toISOString()
  const rows: RssTopicCandidateRow[] = top.map((t) => ({
    id: topicId(t.link ?? '', t.title),
    title: t.title,
    link: t.link,
    source_feed: t.source_feed,
    summary: t.summary,
    published_at: t.published_at,
    relevance_score: t.relevance_score,
    target_audience: targetAudience,
    collected_at: now,
    source,
    updated_at: now,
  }))

  if (!persistCollected) {
    return {
      ok: true,
      targetAudience,
      feedCount: okFeeds.length,
      parsedCount: scored.length,
      savedCount: 0,
      preview: true,
      topics: rows,
      aiEnhanced,
      message: `미리보기: ${rows.length}개 주제 후보 (저장 안 함)`,
    }
  }

  if (rows.length === 0) {
    return {
      ok: true,
      targetAudience,
      feedCount: okFeeds.length,
      parsedCount: scored.length,
      savedCount: 0,
      topics: [],
      message: '관련 키워드에 맞는 기사가 없습니다. 피드·키워드를 조정해 보세요.',
    }
  }

  const { error } = await supabase
    .from('rss_topic_candidates')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    console.error('runRssTopicCollect upsert error:', error)
    return {
      ok: false,
      targetAudience,
      feedCount: okFeeds.length,
      parsedCount: scored.length,
      savedCount: 0,
      topics: rows,
      message: error.message,
    }
  }

  return {
    ok: true,
    targetAudience,
    feedCount: okFeeds.length,
    parsedCount: scored.length,
    savedCount: rows.length,
    topics: rows,
    aiEnhanced,
    message: `RSS 주제 ${rows.length}개 저장${aiEnhanced ? ' (AI 정제)' : ''}`,
  }
}
