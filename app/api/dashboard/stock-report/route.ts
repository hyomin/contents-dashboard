import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { getStockWatchlist } from '@/lib/data/stock-collect'
import { ALL_RSS_FEEDS, getRssTopicCandidates } from '@/lib/data/rss-topic-collect'
import { resolveGeminiModel } from '@/lib/dashboard/gemini-models'
import { generateDailyItemReport, type StockDailyItemResult } from '@/lib/dashboard/stock-daily-report'
import { listGenerationHistory } from '@/lib/data/generation-history-queries'

const ECONOMY_FEED_NAMES = new Set(ALL_RSS_FEEDS.filter((f) => f.category === '경제').map((f) => f.name))
const DAILY_REPORT_CONCURRENCY = 2

function todayKstDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export async function GET() {
  const items = await listGenerationHistory()
  const reports = items.filter((item) => item.category === 'writing' && item.publishTopic.includes('일일 리포트'))
  return NextResponse.json({ items: reports })
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const body = await req.json().catch(() => ({})) as { force?: boolean }
  const force = body.force === true

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 설정하세요.' },
      { status: 503 },
    )
  }

  const reportDate = todayKstDate()

  if (!force) {
    const existing = await listGenerationHistory()
    const todayCount = existing.filter(
      (item) =>
        item.category === 'writing' &&
        item.publishTopic.includes('일일 리포트') &&
        item.publishTopic.includes(reportDate),
    ).length
    if (todayCount > 0) {
      return NextResponse.json(
        {
          alreadyExists: true,
          count: todayCount,
          reportDate,
          message: `오늘(${reportDate}) 이미 ${todayCount}건의 일일 리포트가 생성됐습니다.`,
        },
        { status: 409 },
      )
    }
  }

  const [watchlist, rssCandidates] = await Promise.all([
    getStockWatchlist(),
    getRssTopicCandidates(30),
  ])

  if (watchlist.length === 0) {
    return NextResponse.json({ error: '워치리스트가 비어 있습니다.' }, { status: 400 })
  }

  const economyTopics = rssCandidates
    .filter((c) => ECONOMY_FEED_NAMES.has(c.source_feed))
    .slice(0, 8)
    .map((c) => c.ai_title ?? c.title)

  const model = resolveGeminiModel()

  const items: StockDailyItemResult[] = []
  for (let i = 0; i < watchlist.length; i += DAILY_REPORT_CONCURRENCY) {
    const chunk = watchlist.slice(i, i + DAILY_REPORT_CONCURRENCY)
    const results = await Promise.all(
      chunk.map((item) => generateDailyItemReport(item, economyTopics, reportDate, apiKey, model)),
    )
    items.push(...results)
  }

  return NextResponse.json({ reportDate, items })
}
