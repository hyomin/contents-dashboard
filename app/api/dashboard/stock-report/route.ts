import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { calcChangePct, getStockBarsForChart, getStockWatchlist, type StockWatchlistRow } from '@/lib/data/stock-collect'
import type { StockSeriesForPrompt } from '@/lib/data/stock-collect'
import { ALL_RSS_FEEDS, getRssTopicCandidates } from '@/lib/data/rss-topic-collect'
import { buildStockDailyItemReportPrompt, parseStockReportResponse } from '@/lib/dashboard/stock-report-generate'
import { callGeminiGenerateContent, formatGeminiApiError, resolveGeminiModel } from '@/lib/dashboard/gemini-models'
import { polishToHistory, scriptToDraft } from '@/lib/dashboard/generation-history-types'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import { buildScriptGuideOutput, type ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import { renderStockChartPng, type StockChartIndex } from '@/lib/dashboard/stock-chart-render'
import { resolveStockOutputDir, stockChartFileName, stockOutputRelativePath } from '@/lib/dashboard/stock-output-paths'
import {
  attachPolishedToHistory,
  insertGenerationHistory,
  listGenerationHistory,
} from '@/lib/data/generation-history-queries'

const ECONOMY_FEED_NAMES = new Set(ALL_RSS_FEEDS.filter((f) => f.category === '경제').map((f) => f.name))
const DAILY_CHART_DAYS = 120
const DAILY_PROMPT_DAYS = 10
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

interface StockDailyItemResult {
  ticker: string
  market: StockWatchlistRow['market']
  name: string
  ok: boolean
  historyId?: string
  title?: string
  script?: ScriptGuideOutput
  polished?: ContentPolishResult
  chartFiles?: string[]
  slideFiles?: string[]
  error?: string
}

/** 종목/지수 1건에 대한 일일 리포트 생성 — 시세 조회 → Gemini 호출 → 차트/슬라이드 렌더 → 히스토리 저장 */
async function generateDailyItemReport(
  item: StockWatchlistRow,
  economyTopics: string[],
  reportDate: string,
  apiKey: string,
  model: string,
): Promise<StockDailyItemResult> {
  const base = { ticker: item.ticker, market: item.market, name: item.name }

  try {
    const bars = await getStockBarsForChart(item.ticker, item.market, DAILY_CHART_DAYS)

    const promptBars = bars
      .slice(-DAILY_PROMPT_DAYS)
      .map((bar, i, sorted) => ({
        tradeDate: bar.tradeDate,
        open: bar.open,
        close: bar.close,
        changePct: calcChangePct(bar.close, i > 0 ? sorted[i - 1].close : null),
      }))

    const seriesForPrompt: StockSeriesForPrompt = {
      ticker: item.ticker,
      market: item.market,
      name: item.name,
      assetType: item.asset_type,
      bars: promptBars,
    }

    const chartIndexes: StockChartIndex[] = bars.length >= 5 ? [1, 2, 3, 4] : []

    const { prompt, maxOutputTokens, topic } = buildStockDailyItemReportPrompt(
      seriesForPrompt,
      economyTopics,
      reportDate,
      chartIndexes,
    )

    const result = await callGeminiGenerateContent(apiKey, model, prompt, {
      temperature: 0.5,
      maxOutputTokens,
      timeoutMs: 90_000,
    })

    if (!result.ok) {
      return { ...base, ok: false, error: formatGeminiApiError(result.status, result.error) }
    }

    const polished = parseStockReportResponse(result.text, topic)
    if (!polished) {
      return { ...base, ok: false, error: 'AI 응답 파싱에 실패했습니다.' }
    }

    const script = buildScriptGuideOutput({
      mode: 'direct',
      category: 'writing',
      intent: 'blog',
      targetFormat: 'blog',
      platform: 'naver-blog',
      topic,
      title: polished.title,
      fullScript: polished.fullContent,
      seoKeywords: undefined,
      message: `${item.name} 일일 리포트를 생성했습니다`,
    })

    const now = new Date().toISOString()
    const saved = await insertGenerationHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      publishTopic: `${reportDate} ${item.name} 일일 리포트`,
      category: 'writing',
      referenceCount: 0,
      referenceTitles: [],
      draft: scriptToDraft(script),
      createdAt: now,
      updatedAt: now,
    })

    if (!saved.ok || !saved.item) {
      return { ...base, ok: false, error: saved.error ?? '히스토리 저장 실패' }
    }

    await attachPolishedToHistory(saved.item.id, { ...polishToHistory(polished), chartIndexes })

    const { chartFiles, slideFiles } = renderDailyItemCharts(item, bars, chartIndexes, reportDate)

    if (slideFiles.length > 0) {
      await attachPolishedToHistory(saved.item.id, {
        ...polishToHistory(polished),
        chartIndexes,
        chartImages: [{ name: item.name, slideFiles }],
      })
    }

    return { ...base, ok: true, historyId: saved.item.id, title: polished.title, script, polished, chartFiles, slideFiles }
  } catch (err) {
    console.error(`일일 리포트 생성 실패 (${item.name}):`, err)
    return { ...base, ok: false, error: err instanceof Error ? err.message : '알 수 없는 오류' }
  }
}

/** 종목/지수 차트(raw)·슬라이드(PPT 장표) PNG를 stock/<date>/daily/{chart,slide}/에 저장 */
function renderDailyItemCharts(
  item: StockWatchlistRow,
  bars: Awaited<ReturnType<typeof getStockBarsForChart>>,
  chartIndexes: StockChartIndex[],
  reportDate: string,
): { chartFiles: string[]; slideFiles: string[] } {
  if (bars.length < 5 || chartIndexes.length === 0) return { chartFiles: [], slideFiles: [] }

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const generatedAt = `${reportDate} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const chartFiles: string[] = []
  const slideFiles: string[] = []

  try {
    const chartDir = resolveStockOutputDir(reportDate, 'daily', 'chart')
    const slideDir = resolveStockOutputDir(reportDate, 'daily', 'slide')

    for (const index of chartIndexes) {
      const fileName = stockChartFileName(item.name, index)

      const chartBuffer = renderStockChartPng(index, bars, item.name, item.ticker, item.market, generatedAt, false)
      writeFileSync(resolve(chartDir, fileName), chartBuffer)
      chartFiles.push(stockOutputRelativePath(reportDate, 'daily', 'chart', fileName))

      const slideBuffer = renderStockChartPng(index, bars, item.name, item.ticker, item.market, generatedAt, true)
      writeFileSync(resolve(slideDir, fileName), slideBuffer)
      slideFiles.push(stockOutputRelativePath(reportDate, 'daily', 'slide', fileName))
    }
  } catch (err) {
    console.error(`일일 리포트 차트 이미지 생성 실패 (${item.name}):`, err)
  }

  return { chartFiles, slideFiles }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 설정하세요.' },
      { status: 503 },
    )
  }

  const reportDate = todayKstDate()
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
