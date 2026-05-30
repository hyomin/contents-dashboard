import type { DBVideo, DBChannel } from './supabase'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are',
  '이', '가', '을', '를', '의', '에', '와', '과', '도', '로', '으로', '은', '는', '다',
  '했다', '합니다', '영상', '최신', 'full', 'ver', 'ep', 'part',
])

export interface TrendingKeyword {
  rank: number
  keyword: string
  change: number
  trend: 'up' | 'down'
  count: number
}

export interface DataInsight {
  icon: string
  text: string
}

/** 텍스트가 키워드 중 하나라도 포함하는지 (대소문자 무시) */
export function textMatchesKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}

export function buildKeywordScopedInsights(params: {
  keywords: string[]
  matchingVideoCount: number
  matchingOutlierCount: number
  matchingRssCount: number
  topOutlier?: { title: string; vs_avg: number }
  sampleTitles?: string[]
}): DataInsight[] {
  const { keywords, matchingVideoCount, matchingOutlierCount, matchingRssCount } = params
  const kwLabel = keywords.map((k) => `«${k}»`).join(', ')
  const insights: DataInsight[] = []

  if (matchingVideoCount === 0 && matchingRssCount === 0) {
    insights.push({
      icon: '🔍',
      text: `${kwLabel} 키워드와 직접 매칭되는 수집 영상·RSS 주제가 없습니다. 키워드를 넓히거나 데이터 수집 후 다시 조회해 보세요.`,
    })
    insights.push({
      icon: '💡',
      text: `그래도 ${kwLabel} 주제로 롱폼·숏폼 기획안을 작성하려면, 트렌드 리포트와 RSS 급상승 주제에서 유사 키워드를 교차 확인하세요.`,
    })
    return insights
  }

  insights.push({
    icon: '🎯',
    text: `${kwLabel} 범위 — 관련 영상 ${matchingVideoCount}개 · Outlier ${matchingOutlierCount}개 · RSS ${matchingRssCount}개가 수집 데이터에 있습니다.`,
  })

  if (params.topOutlier) {
    insights.push({
      icon: '🚀',
      text: `키워드 관련 최고 Outlier: «${params.topOutlier.title.slice(0, 50)}${params.topOutlier.title.length > 50 ? '…' : ''}» (${params.topOutlier.vs_avg}x) — 제목·구조 패턴을 벤치마크하세요.`,
    })
  }

  if (params.sampleTitles && params.sampleTitles.length > 0) {
    insights.push({
      icon: '📝',
      text: `유사 제목 패턴: ${params.sampleTitles.slice(0, 3).map((t) => `«${t.slice(0, 30)}${t.length > 30 ? '…' : ''}»`).join(', ')}. 이 톤으로 ${keywords[0]} 콘텐츠 각도를 잡아 보세요.`,
    })
  }

  insights.push({
    icon: '✨',
    text: `${keywords[0]} 키워드를 중심으로 «문제 제기 → 데이터/사례 → 실행 팁» 3막 구조의 콘텐츠를 기획하면 검색·추천 알고리즘 모두에 유리합니다.`,
  })

  return insights.slice(0, 6)
}

function tokenizeTitle(title: string): string[] {
  return title
    .replace(/[#\[\]()【】|·]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim().replace(/[^\w\u3131-\uD79D]/g, ''))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()))
}

export function extractTrendingKeywords(
  videos: Pick<DBVideo, 'title' | 'published_at' | 'vs_avg' | 'format'>[],
  limit = 8,
  formatFilter?: 'short' | 'long' | 'all',
): TrendingKeyword[] {
  const now = Date.now()
  const counts = new Map<string, { score: number; count: number }>()

  const filtered =
    formatFilter && formatFilter !== 'all'
      ? videos.filter((v) => v.format === formatFilter)
      : videos

  for (const v of filtered) {
    const days =
      v.published_at != null
        ? (now - new Date(v.published_at).getTime()) / (1000 * 60 * 60 * 24)
        : 30
    const recency = Math.max(0.3, 1 - days / 30)
    const weight = recency * (1 + Number(v.vs_avg ?? 0) * 0.15)

    for (const word of tokenizeTitle(v.title)) {
      const prev = counts.get(word) ?? { score: 0, count: 0 }
      counts.set(word, { score: prev.score + weight, count: prev.count + 1 })
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)

  const maxScore = sorted[0]?.[1].score ?? 1

  return sorted.map(([keyword, { score, count }], i) => {
    const pct = Math.round((score / maxScore) * 180) + 10
    return {
      rank: i + 1,
      keyword,
      change: pct,
      trend: 'up' as const,
      count,
    }
  })
}

/** 전체/숏폼/롱폼 키워드를 한 번에 추출 */
export function extractTrendingByFormat(
  videos: Pick<DBVideo, 'title' | 'published_at' | 'vs_avg' | 'format'>[],
  limit = 10,
): { all: TrendingKeyword[]; short: TrendingKeyword[]; long: TrendingKeyword[] } {
  return {
    all: extractTrendingKeywords(videos, limit, 'all'),
    short: extractTrendingKeywords(videos, limit, 'short'),
    long: extractTrendingKeywords(videos, limit, 'long'),
  }
}

export function extractTopKeyword(titles: string[]): string {
  const counts = new Map<string, number>()
  for (const title of titles) {
    for (const w of tokenizeTitle(title)) {
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return top?.[0] ?? '—'
}

export function tierFromVsAvg(vsAvg: number): string {
  if (vsAvg >= 5) return 'S'
  if (vsAvg >= 3) return 'A'
  if (vsAvg >= 1.5) return 'B'
  return 'C'
}

export function channelDisplayTier(channel: DBChannel, bestVsAvg: number): string {
  if (bestVsAvg >= 3) return 'A'
  if (bestVsAvg >= 1.5) return 'B'
  const subs = channel.subscribers ?? 0
  if (subs >= 500_000) return 'A'
  if (subs >= 100_000) return 'B'
  return 'C'
}

export function buildInsights(params: {
  totalVideos: number
  avgVsAvg: number
  outlierCount: number
  channelCount: number
  topOutlier?: { title: string; vs_avg: number; channel_name?: string | null }
  topKeyword?: string
}): DataInsight[] {
  const insights: DataInsight[] = []

  if (params.topKeyword) {
    insights.push({
      icon: '🔥',
      text: `수집 영상 제목에서 «${params.topKeyword}» 키워드가 자주 등장합니다. 관련 주제 콘텐츠를 우선 기획해 보세요.`,
    })
  }

  if (params.outlierCount > 0) {
    insights.push({
      icon: '🚀',
      text: `Outlier(vs.Avg≥1.5) ${params.outlierCount}개 · 전체 평균 ${params.avgVsAvg.toFixed(1)}x. 고성과 패턴을 벤치마크에 추가하세요.`,
    })
  } else if (params.totalVideos > 0) {
    insights.push({
      icon: '📊',
      text: `수집 영상 ${params.totalVideos}개 · 평균 vs.Avg ${params.avgVsAvg.toFixed(1)}x. Outlier가 나오면 Repurposing 후보로 활용할 수 있습니다.`,
    })
  }

  if (params.topOutlier) {
    insights.push({
      icon: '💡',
      text: `최고 Outlier: «${params.topOutlier.title.slice(0, 40)}${params.topOutlier.title.length > 40 ? '…' : ''}» (${params.topOutlier.vs_avg}x) — OSMU·숏폼 재가공 후보입니다.`,
    })
  }

  if (params.channelCount > 0) {
    insights.push({
      icon: '📺',
      text: `등록 채널 ${params.channelCount}개 추적 중. «데이터 수집»에서 최신 영상을 갱신하세요.`,
    })
  }

  if (insights.length === 0) {
    insights.push({
      icon: '📥',
      text: '아직 수집된 영상이 없습니다. 채널·콘텐츠 등록 후 데이터 수집을 실행해 주세요.',
    })
  }

  return insights.slice(0, 6)
}
