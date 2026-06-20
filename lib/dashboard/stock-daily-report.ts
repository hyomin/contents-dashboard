import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getStockBarsForChart, calcChangePct, type StockWatchlistRow } from '@/lib/data/stock-collect'
import type { StockSeriesForPrompt } from '@/lib/data/stock-collect'
import { buildStockDailyItemReportPrompt, parseStockReportResponse } from '@/lib/dashboard/stock-report-generate'
import { callGeminiGenerateContent, formatGeminiApiError } from '@/lib/dashboard/gemini-models'
import { polishToHistory, scriptToDraft } from '@/lib/dashboard/generation-history-types'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import { buildScriptGuideOutput, type ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import { renderStockChartPng, type StockChartIndex } from '@/lib/dashboard/stock-chart-render'
import { resolveStockOutputDir, stockChartFileName, stockOutputRelativePath } from '@/lib/dashboard/stock-output-paths'
import { attachPolishedToHistory, insertGenerationHistory } from '@/lib/data/generation-history-queries'

export const DAILY_CHART_DAYS = 120
export const DAILY_PROMPT_DAYS = 10

export interface StockDailyItemResult {
  ticker: string
  market: 'KR' | 'US'
  name: string
  ok: boolean
  /** 시세 데이터 없어 자동 수집 후 생성 예정인 항목 */
  autoCollecting?: boolean
  historyId?: string
  title?: string
  script?: ScriptGuideOutput
  polished?: ContentPolishResult
  slideFiles?: string[]
  error?: string
  warning?: string
  dataDate?: string
}

function renderDailyItemCharts(
  item: StockWatchlistRow,
  bars: Awaited<ReturnType<typeof getStockBarsForChart>>,
  chartIndexes: StockChartIndex[],
  reportDate: string,
): { slideFiles: string[] } {
  if (bars.length < 5 || chartIndexes.length === 0) return { slideFiles: [] }

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const generatedAt = `${reportDate} ${pad(kstNow.getUTCHours())}:${pad(kstNow.getUTCMinutes())} KST`

  const slideFiles: string[] = []

  try {
    const slideDir = resolveStockOutputDir(reportDate, 'daily', 'slide')

    for (const index of chartIndexes) {
      const fileName = stockChartFileName(item.name, index)
      const slideBuffer = renderStockChartPng(index, bars, item.name, item.ticker, item.market, generatedAt, true)
      writeFileSync(resolve(slideDir, fileName), slideBuffer)
      slideFiles.push(stockOutputRelativePath(reportDate, 'daily', 'slide', fileName))
    }
  } catch (err) {
    console.error(`일일 리포트 차트 이미지 생성 실패 (${item.name}):`, err)
  }

  return { slideFiles }
}

/** 종목/지수 1건에 대한 일일 리포트 생성 — 시세 조회 → Gemini 호출 → 차트/슬라이드 렌더 → 히스토리 저장 */
export async function generateDailyItemReport(
  item: StockWatchlistRow,
  economyTopics: string[],
  reportDate: string,
  apiKey: string,
  model: string,
): Promise<StockDailyItemResult> {
  const base = { ticker: item.ticker, market: item.market, name: item.name }

  try {
    const bars = await getStockBarsForChart(item.ticker, item.market, DAILY_CHART_DAYS)

    if (bars.length === 0) {
      const reason = item.market === 'US'
        ? 'US 종목 시세 없음 — ALPHA_VANTAGE_API_KEY 설정 후 시세 수집 필요'
        : '시세 데이터 없음 — 시세 수집 후 다시 시도하세요'
      return { ...base, ok: false, autoCollecting: true, error: reason }
    }

    const dataDate = bars[bars.length - 1]?.tradeDate
    const daysDiff = dataDate
      ? Math.round((new Date(reportDate).getTime() - new Date(dataDate).getTime()) / 86_400_000)
      : 0
    const dataWarning = daysDiff >= 5
      ? `데이터 기준일(${dataDate})이 리포트 날짜(${reportDate})보다 ${daysDiff}일 오래됐습니다`
      : undefined

    const promptBars = bars
      .map((bar, i, sorted) => ({
        tradeDate: bar.tradeDate,
        open: bar.open,
        close: bar.close,
        changePct: calcChangePct(bar.close, i > 0 ? sorted[i - 1].close : null),
      }))
      .slice(-DAILY_PROMPT_DAYS)

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
      id: randomUUID(),
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

    const { slideFiles } = renderDailyItemCharts(item, bars, chartIndexes, reportDate)

    await attachPolishedToHistory(saved.item.id, {
      ...polishToHistory(polished),
      chartIndexes,
      ...(slideFiles.length > 0 ? { chartImages: [{ name: item.name, slideFiles }] } : {}),
    })

    return {
      ...base,
      ok: true,
      historyId: saved.item.id,
      title: polished.title,
      script,
      polished,
      slideFiles,
      warning: dataWarning,
      dataDate,
    }
  } catch (err) {
    console.error(`일일 리포트 생성 실패 (${item.name}):`, err)
    return { ...base, ok: false, error: err instanceof Error ? err.message : '알 수 없는 오류' }
  }
}
