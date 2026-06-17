import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { fetchNaverDailySeries, type StockDailyBar } from '@/lib/data/naver-finance-stock'
import { fetchAlphaVantageDailySeries } from '@/lib/data/alpha-vantage-stock'
import { calcChangePct, type StockSeriesForPrompt } from '@/lib/data/stock-collect'
import { ALL_RSS_FEEDS, getRssTopicCandidates } from '@/lib/data/rss-topic-collect'
import {
  buildSectorResearchReportPrompt,
  buildStockFocusReportPrompt,
  parseStockReportResponse,
} from '@/lib/dashboard/stock-report-generate'
import { callGeminiGenerateContent, formatGeminiApiError, resolveGeminiModel } from '@/lib/dashboard/gemini-models'
import { polishToHistory, scriptToDraft } from '@/lib/dashboard/generation-history-types'
import { buildScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import { renderStockChartPng, type StockChartIndex } from '@/lib/dashboard/stock-chart-render'
import { resolveStockOutputDir, stockChartFileName, stockOutputRelativePath } from '@/lib/dashboard/stock-output-paths'
import { getSectorConstituents, getSectorLabel } from '@/lib/dashboard/stock-sector-directory'
import {
  attachPolishedToHistory,
  insertGenerationHistory,
  listGenerationHistory,
} from '@/lib/data/generation-history-queries'
import { parseJsonBody } from '@/lib/utils/request'

const ECONOMY_FEED_NAMES = new Set(ALL_RSS_FEEDS.filter((f) => f.category === '경제').map((f) => f.name))
const FOCUS_PROMPT_DAYS = 10
const FOCUS_CHART_DAYS = 120
const MAX_FOCUS_ITEMS = 3
const MAX_SECTOR_CONSTITUENTS = 5

/** 분석 종목 수에 따라 생성할 차트 종류(1~4) 결정 — 총 산출 이미지 수가 3~4장이 되도록 분배 */
const CHART_INDEXES_BY_COUNT: Record<number, StockChartIndex[]> = {
  1: [1, 2, 3, 4],
  2: [1, 4],
  3: [1],
}

/** 섹터 모드 — 구성종목당 차트 종류(추세+향후전망 2종으로 축소, 총 이미지 수 통제) */
const SECTOR_CHART_INDEXES: StockChartIndex[] = [1, 4]

interface FocusItemInput {
  market: 'KR' | 'US'
  ticker: string
  name: string
}

function todayKstDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function parseItems(raw: unknown): FocusItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FOCUS_ITEMS) return null

  const items: FocusItemInput[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null
    const e = entry as Record<string, unknown>
    const market = e.market === 'US' ? 'US' : e.market === 'KR' ? 'KR' : null
    const ticker = typeof e.ticker === 'string' ? e.ticker.trim() : ''
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    if (!market || !ticker || !name) return null
    items.push({ market, ticker, name })
  }
  return items
}

export async function GET() {
  const items = await listGenerationHistory()
  const reports = items.filter(
    (item) =>
      item.category === 'writing' &&
      (item.publishTopic.includes('종목 분석 리포트') || item.publishTopic.includes('산업 분석 리포트')),
  )
  return NextResponse.json({ items: reports })
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

  const body = await parseJsonBody(req)

  const sectorId = typeof body.sectorId === 'string' ? body.sectorId.trim() : ''
  let items: FocusItemInput[]
  let sectorLabel: string | null = null

  if (sectorId) {
    const label = getSectorLabel(sectorId)
    if (!label) {
      return NextResponse.json({ error: `알 수 없는 섹터입니다: ${sectorId}` }, { status: 400 })
    }
    sectorLabel = label
    items = getSectorConstituents(sectorId, MAX_SECTOR_CONSTITUENTS)
  } else {
    const parsed = parseItems(body.items)
    if (!parsed) {
      return NextResponse.json({ error: `items는 1~${MAX_FOCUS_ITEMS}개의 { market, ticker, name } 배열이어야 합니다.` }, { status: 400 })
    }
    items = parsed
  }
  const note = typeof body.note === 'string' ? body.note : ''

  const reportDate = todayKstDate()

  const fetched = await Promise.all(
    items.map(async (item) => {
      const result = item.market === 'KR'
        ? await fetchNaverDailySeries(item.ticker, 'stock', FOCUS_CHART_DAYS)
        : await fetchAlphaVantageDailySeries(item.ticker, FOCUS_CHART_DAYS)

      const bars: StockDailyBar[] = result.ok && result.bars
        ? [...result.bars].sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
        : []

      return { item, bars }
    }),
  )

  const seriesList: StockSeriesForPrompt[] = fetched.map(({ item, bars }) => {
    const promptBars = bars
      .map((bar, i, sorted) => ({
        tradeDate: bar.tradeDate,
        open: bar.open,
        close: bar.close,
        changePct: calcChangePct(bar.close, i > 0 ? sorted[i - 1].close : null),
      }))
      .slice(-FOCUS_PROMPT_DAYS)

    return { ticker: item.ticker, market: item.market, name: item.name, assetType: 'stock', bars: promptBars }
  })

  const rssCandidates = await getRssTopicCandidates(30)
  const economyTopics = rssCandidates
    .filter((c) => ECONOMY_FEED_NAMES.has(c.source_feed))
    .slice(0, 8)
    .map((c) => c.ai_title ?? c.title)

  const chartIndexes = sectorLabel ? SECTOR_CHART_INDEXES : (CHART_INDEXES_BY_COUNT[items.length] ?? [1])

  const { prompt, maxOutputTokens, topic } = sectorLabel
    ? buildSectorResearchReportPrompt(sectorLabel, seriesList, economyTopics, reportDate, chartIndexes)
    : buildStockFocusReportPrompt(seriesList, note, economyTopics, reportDate, chartIndexes)
  const model = resolveGeminiModel()

  const result = await callGeminiGenerateContent(apiKey, model, prompt, {
    temperature: 0.5,
    maxOutputTokens,
    timeoutMs: 90_000,
  })

  if (!result.ok) {
    return NextResponse.json({ error: formatGeminiApiError(result.status, result.error) }, { status: 500 })
  }

  const polished = parseStockReportResponse(result.text, topic)
  if (!polished) {
    return NextResponse.json({ error: 'AI 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 })
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
    message: sectorLabel ? `${sectorLabel} 섹터 분석 리포트를 생성했습니다` : '종목 분석 리포트를 생성했습니다',
  })

  const names = items.map((i) => i.name).join('·')
  const publishTopic = sectorLabel
    ? `${reportDate} ${sectorLabel} 산업 분석 리포트`
    : `종목 분석 리포트 - ${names} (${reportDate})`

  const now = new Date().toISOString()
  const saved = await insertGenerationHistory({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    publishTopic,
    category: 'writing',
    referenceCount: 0,
    referenceTitles: [],
    draft: scriptToDraft(script),
    createdAt: now,
    updatedAt: now,
  })

  if (!saved.ok || !saved.item) {
    return NextResponse.json({ error: saved.error ?? '히스토리 저장 실패' }, { status: 500 })
  }

  const attached = await attachPolishedToHistory(saved.item.id, { ...polishToHistory(polished), chartIndexes })

  const charts = renderResearchReportCharts(fetched, reportDate, chartIndexes)

  const chartImages = charts
    .filter((c) => c.slideFiles.length > 0)
    .map((c) => ({ name: c.name, slideFiles: c.slideFiles }))

  let resultItem = attached.ok && attached.item ? attached.item : saved.item
  if (chartImages.length > 0) {
    const reattached = await attachPolishedToHistory(saved.item.id, {
      ...polishToHistory(polished),
      chartIndexes,
      chartImages,
    })
    if (reattached.ok && reattached.item) resultItem = reattached.item
  }

  return NextResponse.json({
    item: resultItem,
    script,
    polished,
    charts,
  })
}

interface ResearchChartResult {
  market: 'KR' | 'US'
  ticker: string
  name: string
  chartFiles: string[]
  slideFiles: string[]
}

/** 분석 종목별 차트(raw)·슬라이드(PPT 장표) PNG를 stock/<date>/research/{chart,slide}/에 저장 (실패해도 리포트 생성 자체는 영향 없음) */
function renderResearchReportCharts(
  fetched: { item: FocusItemInput; bars: StockDailyBar[] }[],
  reportDate: string,
  chartIndexes: StockChartIndex[],
): ResearchChartResult[] {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const generatedAt = `${reportDate} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const results: ResearchChartResult[] = []
  try {
    const chartDir = resolveStockOutputDir(reportDate, 'research', 'chart')
    const slideDir = resolveStockOutputDir(reportDate, 'research', 'slide')

    for (const { item, bars } of fetched) {
      if (bars.length < 5) continue
      const chartFiles: string[] = []
      const slideFiles: string[] = []
      for (const index of chartIndexes) {
        const fileName = stockChartFileName(item.name, index)

        const chartBuffer = renderStockChartPng(index, bars, item.name, item.ticker, item.market, generatedAt, false)
        writeFileSync(resolve(chartDir, fileName), chartBuffer)
        chartFiles.push(stockOutputRelativePath(reportDate, 'research', 'chart', fileName))

        const slideBuffer = renderStockChartPng(index, bars, item.name, item.ticker, item.market, generatedAt, true)
        writeFileSync(resolve(slideDir, fileName), slideBuffer)
        slideFiles.push(stockOutputRelativePath(reportDate, 'research', 'slide', fileName))
      }
      results.push({ market: item.market, ticker: item.ticker, name: item.name, chartFiles, slideFiles })
    }
  } catch (err) {
    console.error('분석 리포트 차트 이미지 생성 실패:', err)
  }
  return results
}
