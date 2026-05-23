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
  ai_title?: string | null
  ai_reason?: string | null
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
  { name: '매일경제', url: 'https://www.mk.co.kr/rss/30000001/' },
  { name: '한국경제', url: 'https://www.hankyung.com/feed/economy' },
  { name: '조선일보 경제', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml' },
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
  // decodeXmlEntities를 먼저 실행해 CDATA 추출 → 그 다음 남은 HTML 태그 제거
  return m ? decodeXmlEntities(m[1]).replace(/<[^>]+>/g, ' ').trim() : ''
}

export function parseRssXml(xml: string): {
  title: string
  link: string
  pubDate?: string
  description?: string
}[] {
  const items: { title: string; link: string; pubDate?: string; description?: string }[] = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
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
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('[rss-topic] feed HTTP error', feed.name, res.status)
      return null
    }
    const buf = await res.arrayBuffer()
    const xml = new TextDecoder('utf-8').decode(buf)
    const items = parseRssXml(xml)
    if (!items.length) return null
    return { feed, items }
  } catch (err) {
    console.error('[rss-topic] feed failed', feed.name, (err as Error).message)
    return null
  }
}

interface GeminiRefinedTopic {
  rank: number
  original: string
  youtube_title: string
  reason: string
}

/** Gemini 2.0 Flash (무료 한도: 일 1500회, 분 15회) */
async function refineWithGemini(
  topics: Array<{ title: string; summary: string | null }>,
  targetAudience: string,
  maxTopics: number,
): Promise<GeminiRefinedTopic[] | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || topics.length === 0) return null

  const topicList = topics
    .slice(0, 15)
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join('\n')

  const prompt = `당신은 ${targetAudience} 타겟 유튜브·블로그 콘텐츠 전문 기획자입니다.
아래 뉴스 기사 제목 목록에서 ${targetAudience}가 실제로 관심 가질 주제 ${maxTopics}개를 선별해 주세요.

조건:
- 클릭하고 싶은 유튜브 영상 제목으로 재구성 (30자 이내)
- 선별 이유를 한 줄로 설명
- JSON 배열로만 응답 (앞뒤 다른 텍스트 없이)

응답 형식 (예시):
[
  {"rank":1,"original":"원본제목","youtube_title":"유튜브 제목 제안","reason":"선별 이유"},
  ...
]

뉴스 제목 목록:
${topicList}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
    )
    if (!res.ok) {
      console.error('[rss-topic] gemini http', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null
    const parsed: GeminiRefinedTopic[] = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? parsed.slice(0, maxTopics) : null
  } catch (err) {
    console.error('[rss-topic] gemini failed', err)
    return null
  }
}

/** Claude Haiku fallback (ANTHROPIC_API_KEY 있을 때) */
async function refineWithClaude(
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
    console.error('[rss-topic] claude failed', err)
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
  let aiProvider: string | null = null

  if (options?.useAi !== false) {
    // 1순위: Gemini (무료 한도 넉넉)
    const geminiResults = await refineWithGemini(
      top.map((t) => ({ title: t.title, summary: t.summary })),
      targetAudience,
      maxTopics,
    )

    if (geminiResults?.length) {
      aiEnhanced = true
      aiProvider = 'gemini'
      const matched = new Set<number>()
      const aiOrdered: Array<Scored & { ai_title?: string | null; ai_reason?: string | null }> = []
      for (const ai of geminiResults) {
        const idx = top.findIndex(
          (t, i) =>
            !matched.has(i) &&
            (t.title.includes(ai.original.slice(0, 12)) ||
              ai.original.includes(t.title.slice(0, 12))),
        )
        const base = idx >= 0 ? top[idx] : top[aiOrdered.length] ?? top[0]
        if (idx >= 0) matched.add(idx)
        aiOrdered.push({
          ...base,
          title: ai.youtube_title || base.title,
          summary: ai.reason ? `[Gemini] ${ai.reason}` : base.summary,
          relevance_score: (base?.relevance_score ?? 0) + 50,
          ai_title: ai.youtube_title || null,
          ai_reason: ai.reason || null,
        })
      }
      // 미매칭 원본으로 부족분 채우기
      for (let i = 0; i < top.length && aiOrdered.length < maxTopics; i++) {
        if (!matched.has(i)) aiOrdered.push(top[i])
      }
      top = aiOrdered.slice(0, maxTopics)
    } else if (process.env.ANTHROPIC_API_KEY) {
      // 2순위: Claude Haiku fallback
      const claudeLines = await refineWithClaude(
        top.map((t) => t.title),
        targetAudience,
        maxTopics,
      )
      if (claudeLines?.length) {
        aiEnhanced = true
        aiProvider = 'claude'
        const matched = new Set<number>()
        const aiOrdered: Scored[] = []
        for (const line of claudeLines) {
          const idx = top.findIndex(
            (t, i) =>
              !matched.has(i) &&
              (t.title.includes(line.slice(0, 12)) || line.includes(t.title.slice(0, 12))),
          )
          if (idx >= 0) {
            matched.add(idx)
            aiOrdered.push({
              ...top[idx],
              title: line,
              relevance_score: top[idx].relevance_score + 50,
            })
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
    ai_title: (t as RssTopicCandidateRow).ai_title ?? null,
    ai_reason: (t as RssTopicCandidateRow).ai_reason ?? null,
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

  // ai_title·ai_reason 컬럼이 없는 경우를 대비해 제거 후 재시도
  const rowsClean = rows.map(({ ai_title, ai_reason, ...rest }) =>
    ai_title !== undefined || ai_reason !== undefined ? { ...rest, ai_title, ai_reason } : rest,
  )
  let { error } = await supabase
    .from('rss_topic_candidates')
    .upsert(rowsClean, { onConflict: 'id' })

  if (error?.message?.includes('ai_title') || error?.message?.includes('ai_reason')) {
    const rowsBase = rows.map(({ ai_title: _a, ai_reason: _r, ...rest }) => rest)
    const result = await supabase.from('rss_topic_candidates').upsert(rowsBase, { onConflict: 'id' })
    error = result.error
  }

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
    message: `RSS 주제 ${rows.length}개 저장${aiEnhanced ? ` (${aiProvider === 'gemini' ? 'Gemini' : 'Claude'} 정제)` : ''}`,
  }
}
