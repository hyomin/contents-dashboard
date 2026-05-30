import { NextResponse } from 'next/server'
import { buildInsights, buildKeywordScopedInsights, extractTrendingKeywords, textMatchesKeywords } from '@/lib/data/analytics-from-videos'
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

/** 간단한 메모리 캐시 (30분) */
const cache: {
  data: { sections: InsightSection[]; cachedAt: number } | null
} = { data: null }
const CACHE_TTL = 30 * 60 * 1000

function parseJsonItems(text: string): InsightItem[] {
  if (!text) return []
  try {
    // 마크다운 코드 펜스 제거 (```json ... ``` 또는 ``` ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fenceMatch ? fenceMatch[1].trim() : text

    // JSON 배열 추출
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!arrayMatch) return []

    // trailing comma 수정 (Gemini 자주 생성하는 오류)
    const fixedJson = arrayMatch[0].replace(/,\s*([}\]])/g, '$1')

    const parsed = JSON.parse(fixedJson)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is InsightItem => x != null && typeof x.text === 'string')
      .map((x) => ({
        icon: typeof x.icon === 'string' && x.icon ? x.icon : '💡',
        text: String(x.text).trim(),
        action: x.action ? String(x.action) : undefined,
      }))
  } catch {
    return []
  }
}

/**
 * Gemini API 호출 (모델 순차 시도 + Thinking 모델 대응)
 *
 * Gemini 2.5 Flash는 "Thinking 모델"이라 응답 parts에 { thought: true } 파츠가
 * 먼저 나오고 실제 텍스트가 그 뒤에 온다. parts[0].text를 무조건 읽으면
 * 내부 추론 텍스트를 읽게 되어 JSON 파싱이 항상 실패한다.
 * thought 파츠를 제외한 실제 출력 텍스트만 수집한다.
 */
async function callGemini(
  prompt: string,
  useSearch = false,
): Promise<{ text: string; sources: GroundingSource[]; modelUsed?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return { text: '', sources: [] }

  // 시도 순서: 2.5 Flash → 2.0 Flash (fallback)
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash']

  for (const model of models) {
    try {
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          // 2.5 Flash Thinking 모드 비활성화 → 빠르고 예측 가능한 JSON 출력
          ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }
      if (useSearch) {
        body.tools = [{ googleSearch: {} }]
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(40000),
        },
      )

      if (!res.ok) {
        const errText = await res.text()
        console.warn(`[insights] ${model} HTTP ${res.status}:`, errText.slice(0, 200))
        continue // 다음 모델 시도
      }

      const data = (await res.json()) as {
        candidates?: {
          content?: { parts?: { text?: string; thought?: boolean }[] }
          groundingMetadata?: {
            groundingChunks?: { web?: { title?: string; uri?: string } }[]
          }
        }[]
      }

      const parts = data.candidates?.[0]?.content?.parts ?? []

      // Thinking 모델: thought:true 파츠를 제외한 실제 응답 텍스트만 수집
      const nonThoughtParts = parts.filter((p) => !p.thought)
      const text =
        nonThoughtParts.map((p) => p.text ?? '').join('') ||
        parts.map((p) => p.text ?? '').join('')

      if (!text) {
        console.warn(`[insights] ${model} empty response`)
        continue
      }

      const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
      const sources: GroundingSource[] = chunks
        .filter((c) => c.web?.uri)
        .map((c) => ({ title: c.web?.title ?? c.web?.uri ?? '', url: c.web?.uri ?? '' }))
        .slice(0, 5)

      return { text, sources, modelUsed: model }
    } catch (err) {
      console.warn(`[insights] ${model} exception:`, err instanceof Error ? err.message : err)
    }
  }

  return { text: '', sources: [] }
}

const JSON_FORMAT = `[{"icon":"이모지","text":"설명 2-3문장","action":"추천 액션"}]`

/** 키워드별 캐시 (30분) */
const keywordCache = new Map<string, { sections: InsightSection[]; cachedAt: number }>()

function normalizeKeywords(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return [...new Set(raw.split(/[,，\s]+/).map((k) => k.trim()).filter(Boolean))].slice(0, 5)
}

function keywordCacheKey(keywords: string[]): string {
  return keywords.map((k) => k.toLowerCase()).sort().join('|')
}

async function buildKeywordScopedSections(
  keywords: string[],
  videos: Awaited<ReturnType<typeof getVideosForAnalytics>>,
  outliers: Awaited<ReturnType<typeof getOutlierVideos>>,
  rssTopics: Awaited<ReturnType<typeof getRssTopicCandidates>>,
  hasGemini: boolean,
): Promise<InsightSection[]> {
  const matchingVideos = videos.filter((v) => textMatchesKeywords(v.title, keywords))
  const matchingOutliers = outliers.filter((v) => textMatchesKeywords(v.title, keywords))
  const matchingRss = rssTopics.filter((t) =>
    textMatchesKeywords(`${t.ai_title ?? ''} ${t.title}`, keywords),
  )

  const outlierTitles = matchingOutliers
    .slice(0, 8)
    .map((v, i) => `${i + 1}. "${v.title}" (vs.avg ${Number(v.vs_avg).toFixed(1)}x)`)
    .join('\n')
  const rssList = matchingRss
    .slice(0, 8)
    .map((t, i) => `${i + 1}. ${t.ai_title ?? t.title}`)
    .join('\n')
  const sampleTitles = matchingVideos.slice(0, 5).map((v) => v.title)
  const kwLabel = keywords.join(', ')

  const fallbackItems = buildKeywordScopedInsights({
    keywords,
    matchingVideoCount: matchingVideos.length,
    matchingOutlierCount: matchingOutliers.length,
    matchingRssCount: matchingRss.length,
    topOutlier: matchingOutliers[0]
      ? { title: matchingOutliers[0].title, vs_avg: Number(matchingOutliers[0].vs_avg) }
      : undefined,
    sampleTitles,
  })

  if (!hasGemini) {
    return [
      {
        type: 'personal',
        title: `🔍 «${kwLabel}» 키워드 인사이트`,
        subtitle: `관련 영상 ${matchingVideos.length}개 · Outlier ${matchingOutliers.length}개 · RSS ${matchingRss.length}개`,
        items: fallbackItems,
        isAi: false,
      },
    ]
  }

  const personalRes = await callGemini(
    `당신은 유튜브 콘텐츠 전략가입니다.
사용자가 관심 있는 키워드: ${kwLabel}

**반드시 이 키워드 범위 안에서만** 아래 수집 데이터를 분석해 콘텐츠 제작 추천 4가지를 해주세요.
키워드와 무관한 일반 트렌드는 제외하세요.

[키워드 관련 Outlier 영상]
${outlierTitles || '매칭 데이터 없음'}

[키워드 관련 RSS 주제]
${rssList || '매칭 데이터 없음'}

[키워드 관련 영상 제목 샘플]
${sampleTitles.length > 0 ? sampleTitles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '매칭 데이터 없음'}

각 추천은 «${kwLabel}» 키워드와 직접 연관되어야 합니다. 구체적이고 실행 가능하게.
반드시 JSON 배열만 응답 (다른 텍스트 없이):
${JSON_FORMAT}`,
    false,
  )

  const personalItems = parseJsonItems(personalRes.text)
  const AI_FAIL_ITEM: InsightItem = {
    icon: '⚠️',
    text: '키워드 분석을 가져오지 못했습니다. 다시 조회해 주세요.',
  }

  return [
    {
      type: 'personal',
      title: `🔍 «${kwLabel}» 키워드 인사이트`,
      subtitle: `관련 영상 ${matchingVideos.length}개 · Outlier ${matchingOutliers.length}개 · RSS ${matchingRss.length}개 · Gemini 분석`,
      items: personalItems.length > 0 ? personalItems : fallbackItems.length > 0 ? fallbackItems : [AI_FAIL_ITEM],
      isAi: personalItems.length > 0,
    },
  ]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bust = searchParams.has('bust')
  const keywordsParam = normalizeKeywords(searchParams.get('keywords'))

  // ── 키워드 스코프 조회 (개요 화면) ─────────────────────────────
  if (keywordsParam.length > 0) {
    const cacheKey = keywordCacheKey(keywordsParam)
    if (!bust) {
      const hit = keywordCache.get(cacheKey)
      if (hit && Date.now() - hit.cachedAt < CACHE_TTL) {
        return NextResponse.json({ sections: hit.sections, cached: true, scoped: true, keywords: keywordsParam })
      }
    }

    const [videos, outliers, rssTopics] = await Promise.all([
      getVideosForAnalytics(500),
      getOutlierVideos(1.5, 30),
      getRssTopicCandidates(30),
    ])
    const hasGemini = !!process.env.GEMINI_API_KEY?.trim()
    const sections = await buildKeywordScopedSections(keywordsParam, videos, outliers, rssTopics, hasGemini)
    keywordCache.set(cacheKey, { sections, cachedAt: Date.now() })
    return NextResponse.json({ sections, cached: false, scoped: true, keywords: keywordsParam })
  }

  // 캐시 히트 (bust 없을 때만)
  if (!bust && cache.data && Date.now() - cache.data.cachedAt < CACHE_TTL) {
    return NextResponse.json({ sections: cache.data.sections, cached: true })
  }
  if (bust) cache.data = null

  // Supabase 데이터 수집
  const [videos, stats, outliers, channels, rssTopics] = await Promise.all([
    getVideosForAnalytics(500),
    getVideoStats(),
    getOutlierVideos(1.5, 10),
    getChannels('youtube'),
    getRssTopicCandidates(15),
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
  const outlierTitles = outliers.slice(0, 10).map((v, i) => `${i + 1}. "${v.title}" (vs.avg ${Number(v.vs_avg).toFixed(1)}x)`).join('\n')
  const keywordList = trending.slice(0, 10).map((k) => k.keyword).join(', ')
  const rssList = rssTopics.slice(0, 12).map((t, i) => `${i + 1}. ${t.ai_title ?? t.title}`).join('\n')
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

  const AI_FAIL_ITEM: InsightItem = {
    icon: '⚠️',
    text: 'AI 분석을 가져오지 못했습니다. "↻ 새로 분석" 버튼으로 다시 시도해주세요.',
  }

  sections = [
    {
      type: 'korea',
      title: '🇰🇷 지금 한국 트렌드',
      subtitle: 'Google 실시간 검색 기반 · Gemini 분석',
      items: koreaItems.length > 0 ? koreaItems : [AI_FAIL_ITEM],
      sources: koreaRes.status === 'fulfilled' ? koreaRes.value.sources : [],
      isAi: koreaItems.length > 0,
    },
    {
      type: 'personal',
      title: '📊 내 데이터 기반 추천',
      subtitle: `수집 영상 ${stats.total}개 · Outlier ${outliers.length}개 · 트렌드 키워드 ${trending.length}개 · RSS ${rssTopics.length}개 분석`,
      items: personalItems.length > 0 ? personalItems : fallbackItems.length > 0 ? fallbackItems : [AI_FAIL_ITEM],
      isAi: personalItems.length > 0,
    },
    {
      type: 'global',
      title: '🌐 지금 글로벌 트렌드',
      subtitle: 'Google 실시간 검색 기반 · Gemini 분석',
      items: globalItems.length > 0 ? globalItems : [AI_FAIL_ITEM],
      sources: globalRes.status === 'fulfilled' ? globalRes.value.sources : [],
      isAi: globalItems.length > 0,
    },
  ]

  cache.data = { sections, cachedAt: Date.now() }
  return NextResponse.json({ sections, cached: false })
}
