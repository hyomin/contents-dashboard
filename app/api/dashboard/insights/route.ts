import { NextResponse } from 'next/server'
import { buildInsights, extractTrendingKeywords } from '@/lib/data/analytics-from-videos'
import { getOutlierVideos, getVideoStats, getVideosForAnalytics, getChannels } from '@/lib/data/queries'
import { getRssTopicCandidates } from '@/lib/data/rss-topic-collect'

export interface InsightItem {
  icon: string
  text: string
  action?: string
}

export interface GroundingSource {
  title: string
  url: string
}

export interface InsightSection {
  type: 'korea' | 'personal' | 'global'
  title: string
  subtitle: string
  items: InsightItem[]
  sources?: GroundingSource[]
  isAi: boolean
}

/** 간단한 메모리 캐시 (10분) */
const cache: {
  data: { sections: InsightSection[]; cachedAt: number } | null
} = { data: null }
const CACHE_TTL = 10 * 60 * 1000

function parseJsonItems(text: string): InsightItem[] {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is InsightItem => typeof x?.text === 'string')
      .map((x) => ({ icon: x.icon ?? '💡', text: x.text, action: x.action }))
  } catch {
    return []
  }
}

async function callGemini(
  prompt: string,
  useSearch = false,
): Promise<{ text: string; sources: GroundingSource[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return { text: '', sources: [] }

  const model = useSearch ? 'gemini-2.0-flash' : 'gemini-2.5-flash'
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1200,
      ...(useSearch ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
    },
  }
  if (useSearch) {
    body.tools = [{ google_search: {} }]
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    },
  )

  if (!res.ok) {
    console.error('[insights] gemini error', res.status, await res.text())
    return { text: '', sources: [] }
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] }
      groundingMetadata?: {
        groundingChunks?: { web?: { title?: string; uri?: string } }[]
      }
    }[]
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const sources: GroundingSource[] = chunks
    .filter((c) => c.web?.uri)
    .map((c) => ({ title: c.web?.title ?? c.web?.uri ?? '', url: c.web?.uri ?? '' }))
    .slice(0, 5)

  return { text, sources }
}

const JSON_FORMAT = `[{"icon":"이모지","text":"설명 2-3문장","action":"추천 액션"}]`

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bust = searchParams.has('bust')

  // 캐시 히트 (bust 없을 때만)
  if (!bust && cache.data && Date.now() - cache.data.cachedAt < CACHE_TTL) {
    return NextResponse.json({ sections: cache.data.sections, cached: true })
  }
  if (bust) cache.data = null

  // Supabase 데이터 수집
  const [videos, stats, outliers, channels, rssTopics] = await Promise.all([
    getVideosForAnalytics(200),
    getVideoStats(),
    getOutlierVideos(1.5, 5),
    getChannels('youtube'),
    getRssTopicCandidates(10),
  ])

  const trending = extractTrendingKeywords(videos, 8)

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const hasGemini = !!apiKey

  let sections: InsightSection[]

  if (!hasGemini) {
    // Gemini 없으면 규칙 기반 fallback
    const fallback = buildInsights({
      totalVideos: stats.total,
      avgVsAvg: stats.avgVsAvg,
      outlierCount: outliers.length,
      channelCount: channels.length,
      topOutlier: outliers[0]
        ? { title: outliers[0].title, vs_avg: Number(outliers[0].vs_avg), channel_name: outliers[0].channel_name }
        : undefined,
      topKeyword: trending[0]?.keyword,
    })
    sections = [
      {
        type: 'personal',
        title: '📊 내 데이터 기반 추천',
        subtitle: '수집된 영상·채널 통계 기반',
        items: fallback,
        isAi: false,
      },
    ]
    return NextResponse.json({ sections, cached: false })
  }

  // ── 컨텍스트 준비 ─────────────────────────────────────────────
  const outlierTitles = outliers.slice(0, 5).map((v, i) => `${i + 1}. "${v.title}" (vs.avg ${Number(v.vs_avg).toFixed(1)}x)`).join('\n')
  const keywordList = trending.slice(0, 6).map((k) => k.keyword).join(', ')
  const rssList = rssTopics.slice(0, 8).map((t, i) => `${i + 1}. ${t.ai_title ?? t.title}`).join('\n')
  const catList = Array.from(new Set(channels.map((c) => (c as { category?: string }).category).filter(Boolean))).join(', ') || '미분류'

  // ── 3개 프롬프트 병렬 실행 ────────────────────────────────────
  const [koreaRes, personalRes, globalRes] = await Promise.allSettled([
    // 1. 한국 실시간 트렌드 (Google Search Grounding)
    callGemini(
      `지금 한국에서 급상승 중인 YouTube·SNS 콘텐츠 트렌드 4가지를 분석해줘.
2026년 최신 기준으로, 콘텐츠 크리에이터가 지금 당장 참고할 만한 내용으로 작성해.
반드시 JSON 배열만 응답 (다른 텍스트 없이):
${JSON_FORMAT}`,
      true, // Google Search
    ),

    // 2. 내 데이터 기반 추천
    callGemini(
      `당신은 유튜브 콘텐츠 전략가입니다. 아래 데이터를 분석해 다음 콘텐츠 제작 추천 4가지를 해주세요.

[최고 성과 영상 (Outlier)]
${outlierTitles || '데이터 없음'}

[최근 트렌딩 키워드]
${keywordList || '데이터 없음'}

[최근 RSS 급상승 주제]
${rssList || '데이터 없음'}

[내 채널 카테고리]
${catList}

이 데이터를 바탕으로 지금 만들어야 할 콘텐츠를 추천하세요. 구체적이고 실행 가능한 내용으로.
반드시 JSON 배열만 응답 (다른 텍스트 없이):
${JSON_FORMAT}`,
      false,
    ),

    // 3. 글로벌 트렌드 (Google Search Grounding)
    callGemini(
      `지금 전 세계(글로벌)에서 급상승 중인 YouTube·SNS 콘텐츠 트렌드 4가지를 분석해줘.
한국 콘텐츠 크리에이터가 글로벌 흐름을 참고할 수 있도록 작성해.
2026년 최신 기준으로.
반드시 JSON 배열만 응답 (다른 텍스트 없이):
${JSON_FORMAT}`,
      true, // Google Search
    ),
  ])

  const koreaItems =
    koreaRes.status === 'fulfilled' ? parseJsonItems(koreaRes.value.text) : []
  const personalItems =
    personalRes.status === 'fulfilled' ? parseJsonItems(personalRes.value.text) : []
  const globalItems =
    globalRes.status === 'fulfilled' ? parseJsonItems(globalRes.value.text) : []

  // fallback: Gemini 실패 시 규칙 기반으로 보완
  const fallbackItems = buildInsights({
    totalVideos: stats.total,
    avgVsAvg: stats.avgVsAvg,
    outlierCount: outliers.length,
    channelCount: channels.length,
    topOutlier: outliers[0]
      ? { title: outliers[0].title, vs_avg: Number(outliers[0].vs_avg), channel_name: outliers[0].channel_name }
      : undefined,
    topKeyword: trending[0]?.keyword,
  })

  sections = [
    {
      type: 'korea',
      title: '🇰🇷 지금 한국 트렌드',
      subtitle: 'Google 실시간 검색 기반 · Gemini 분석',
      items: koreaItems.length > 0 ? koreaItems : [{ icon: '📡', text: '한국 트렌드 데이터를 불러오는 중입니다. 잠시 후 새로고침해주세요.' }],
      sources: koreaRes.status === 'fulfilled' ? koreaRes.value.sources : [],
      isAi: koreaItems.length > 0,
    },
    {
      type: 'personal',
      title: '📊 내 데이터 기반 추천',
      subtitle: `수집 영상 ${stats.total}개 · Outlier ${outliers.length}개 · RSS ${rssTopics.length}개 분석`,
      items: personalItems.length > 0 ? personalItems : fallbackItems,
      isAi: personalItems.length > 0,
    },
    {
      type: 'global',
      title: '🌐 지금 글로벌 트렌드',
      subtitle: 'Google 실시간 검색 기반 · Gemini 분석',
      items: globalItems.length > 0 ? globalItems : [{ icon: '🌍', text: '글로벌 트렌드 데이터를 불러오는 중입니다. 잠시 후 새로고침해주세요.' }],
      sources: globalRes.status === 'fulfilled' ? globalRes.value.sources : [],
      isAi: globalItems.length > 0,
    },
  ]

  cache.data = { sections, cachedAt: Date.now() }
  return NextResponse.json({ sections, cached: false })
}
