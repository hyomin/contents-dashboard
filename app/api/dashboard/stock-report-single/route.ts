import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { runStockCollectForTicker } from '@/lib/data/stock-collect'
import { ALL_RSS_FEEDS, getRssTopicCandidates } from '@/lib/data/rss-topic-collect'
import { resolveGeminiModel } from '@/lib/dashboard/gemini-models'
import { generateDailyItemReport, type StockDailyItemResult } from '@/lib/dashboard/stock-daily-report'
import { stockWatchlistId } from '@/lib/dashboard/stock-config'
import type { StockMarket, StockAssetType } from '@/lib/dashboard/stock-config'

const ECONOMY_FEED_NAMES = new Set(ALL_RSS_FEEDS.filter((f) => f.category === '경제').map((f) => f.name))

function todayKstDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/**
 * 단일 종목 시세 수집 → 리포트 생성 (W11 미실행으로 데이터 없는 종목 자동 복구용)
 * POST { ticker, market, assetType, name, reportDate? }
 */
export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const body = await req.json().catch(() => ({})) as {
    ticker?: string
    market?: string
    assetType?: string
    name?: string
    reportDate?: string
  }

  const ticker = (body.ticker ?? '').trim()
  const market: StockMarket = body.market === 'US' ? 'US' : 'KR'
  const assetType: StockAssetType = body.assetType === 'index' ? 'index' : 'stock'
  const name = (body.name ?? ticker).trim()
  const reportDate = body.reportDate ?? todayKstDate()

  if (!ticker) {
    return NextResponse.json({ ok: false, error: 'ticker가 필요합니다' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, ticker, market, name, error: 'GEMINI_API_KEY 미설정' } satisfies StockDailyItemResult,
    )
  }

  // Step 1: 해당 종목 시세 수집 (KR: 네이버 금융, US: Alpha Vantage)
  const collectResult = await runStockCollectForTicker(ticker, market, assetType)
  if (!collectResult.ok) {
    const errorMsg = market === 'US'
      ? `시세 수집 실패 — US 종목은 ALPHA_VANTAGE_API_KEY 설정 후 재시도하세요 (${collectResult.reason ?? ''})`
      : `시세 수집 실패: ${collectResult.reason ?? '알 수 없는 오류'}`
    return NextResponse.json({ ok: false, ticker, market, name, error: errorMsg } satisfies StockDailyItemResult)
  }

  // Step 2: RSS 이슈 토픽 로드 + 리포트 생성
  const rssCandidates = await getRssTopicCandidates(30)
  const economyTopics = rssCandidates
    .filter((c) => ECONOMY_FEED_NAMES.has(c.source_feed))
    .slice(0, 8)
    .map((c) => c.ai_title ?? c.title)

  const model = resolveGeminiModel()
  const item = {
    id: stockWatchlistId(market, ticker),
    ticker,
    market,
    asset_type: assetType,
    name,
    sort_order: 0,
  }

  const result = await generateDailyItemReport(item, economyTopics, reportDate, apiKey, model)
  return NextResponse.json(result)
}
