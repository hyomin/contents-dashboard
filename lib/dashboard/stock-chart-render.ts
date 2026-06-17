/**
 * 주식 차트 PNG 렌더링 — ECharts + @napi-rs/canvas 기반, "PPT 장표" 스타일
 *
 * scripts/stock-chart-export.ts(CLI)와 app/api/dashboard/stock-report-focus(종목 분석 리포트 API)에서
 * 공유하는 렌더링 코어. 4종 차트:
 *   1: 가격 추이 & 이동평균선(MA5/20/60)
 *   2: 거래량 (상승일=적색 / 하락일=청색)
 *   3: 일별 등락률(%) + 평균선
 *   4: 추세선 & 향후 전망(선형회귀 추정, 참고용)
 */
import { existsSync } from 'node:fs'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import type { StockDailyBar } from '@/lib/data/naver-finance-stock'

// 한글 렌더링용 폰트 등록 (macOS 기본 탑재 폰트 우선)
const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
  '/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf',
]
let FONT_FAMILY = 'sans-serif'
for (const path of FONT_CANDIDATES) {
  if (existsSync(path)) {
    GlobalFonts.registerFromPath(path, 'StockChartKR')
    FONT_FAMILY = 'StockChartKR'
    break
  }
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < period) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += values[j]
    return Math.round((sum / period) * 100) / 100
  })
}

function calcChangePct(close: number, prevClose: number | null): number | null {
  if (prevClose === null || prevClose === 0) return null
  return Math.round(((close - prevClose) / prevClose) * 10000) / 100
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let x = 0; x < n; x++) {
    const y = values[x]
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }
  const denom = n * sumXX - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** UTC 기준 날짜 연산 — 로컬 타임존(KST 등) 변환 시 toISOString()이 하루 밀리는 문제 방지 */
function addBusinessDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  let added = 0
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1)
    const dow = date.getUTCDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return date.toISOString().slice(0, 10)
}

const WIDTH = 1280
const HEIGHT = 720
const HEADER_H = 90
const FOOTER_H = 38
// 적색=상승 / 청색=하락 (국내 관행) — 남색 배경에서도 또렷하게 보이도록 밝은 톤 사용
const COLOR_UP = '#f87171'
const COLOR_DOWN = '#38bdf8'
const COLOR_FLAT = '#64748b'
/** "프리미엄 리서치" 톤 — 짙은 남색 그라데이션 배경 */
const BG_GRADIENT = {
  type: 'linear' as const,
  x: 0, y: 0, x2: 0, y2: 1,
  colorStops: [
    { offset: 0, color: '#16213f' },
    { offset: 1, color: '#0a1020' },
  ],
}
const HEADER_BG = '#16213f'
const FOOTER_BG = '#0a1020'
const ACCENT_GOLD = '#fbbf24'
const GRID_LINE = 'rgba(148, 163, 184, 0.16)'
const AXIS_LINE = 'rgba(148, 163, 184, 0.35)'
const AXIS_LABEL_COLOR = '#cbd5e1'
const LEGEND_COLOR = '#e2e8f0'
const COMMON_GRID = { left: 76, right: 56, top: HEADER_H + 40, bottom: FOOTER_H + 56, containLabel: true }
/** frame=false(차트 단독 출력)용 — 전체 캔버스를 차트 영역으로 사용, 범례를 위한 최소 여백만 확보 */
const RAW_GRID = { left: 64, right: 32, top: 52, bottom: 44, containLabel: true }
/** frame=false 중 범례가 없는 차트(거래량/등락률)용 — 상단 여백 최소화 */
const RAW_GRID_PLAIN = { left: 64, right: 32, top: 22, bottom: 44, containLabel: true }

/** PPT 장표 느낌의 상단 타이틀 바 + 하단 출처/주석 바 — 남색 + 골드 액센트로 "프리미엄 리서치" 톤 */
function slideFrame(title: string, subtitle: string, footer: string) {
  return [
    { type: 'rect' as const, left: 0, top: 0, shape: { width: WIDTH, height: HEADER_H }, style: { fill: HEADER_BG } },
    { type: 'rect' as const, left: 0, top: HEADER_H - 3, shape: { width: WIDTH, height: 3 }, style: { fill: ACCENT_GOLD, opacity: 0.85 } },
    { type: 'text' as const, left: 32, top: 18, style: { text: title, fill: '#ffffff', font: `bold 30px ${FONT_FAMILY}` } },
    { type: 'text' as const, left: 32, top: 58, style: { text: subtitle, fill: '#93c5fd', font: `16px ${FONT_FAMILY}` } },
    { type: 'rect' as const, left: 0, top: HEIGHT - FOOTER_H, shape: { width: WIDTH, height: FOOTER_H }, style: { fill: FOOTER_BG } },
    { type: 'rect' as const, left: 0, top: HEIGHT - FOOTER_H, shape: { width: WIDTH, height: 1 }, style: { fill: 'rgba(148, 163, 184, 0.25)' } },
    { type: 'text' as const, left: 32, top: HEIGHT - FOOTER_H + 11, style: { text: footer, fill: '#94a3b8', font: `13px ${FONT_FAMILY}` } },
  ]
}

function sourceLabel(market: 'KR' | 'US'): string {
  return market === 'KR' ? '네이버 금융' : 'Alpha Vantage'
}

function buildPriceChart(bars: StockDailyBar[], name: string, ticker: string, market: 'KR' | 'US', marketLabel: string, generatedAt: string, frame: boolean): EChartsOption {
  const dates = bars.map((b) => b.tradeDate)
  const closes = bars.map((b) => b.close)
  const last = bars[bars.length - 1]
  const subtitle = `${marketLabel} · ${ticker} · ${dates[0]} ~ ${dates[dates.length - 1]} · 최근 종가 ${last.close.toLocaleString()}`
  const footer = `데이터 출처: ${sourceLabel(market)} · 기준: ${generatedAt} · 참고용, 투자 판단 근거로 사용 불가`

  return {
    backgroundColor: BG_GRADIENT,
    textStyle: { fontFamily: FONT_FAMILY },
    graphic: frame ? slideFrame(`${name} 가격 추이 & 이동평균선`, subtitle, footer) : undefined,
    legend: {
      top: frame ? HEADER_H + 10 : 10,
      left: 'center',
      data: ['종가', 'MA5', 'MA20', 'MA60'],
      textStyle: { fontFamily: FONT_FAMILY, color: LEGEND_COLOR, fontSize: 15 },
      itemWidth: 22,
      itemGap: 24,
    },
    grid: frame ? COMMON_GRID : RAW_GRID,
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR },
      axisLine: { lineStyle: { color: AXIS_LINE } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [
      { name: '종가', type: 'line', data: closes, showSymbol: false, lineStyle: { color: '#f8fafc', width: 2.5 } },
      { name: 'MA5', type: 'line', data: sma(closes, 5), showSymbol: false, lineStyle: { color: '#fbbf24', width: 1.5 } },
      { name: 'MA20', type: 'line', data: sma(closes, 20), showSymbol: false, lineStyle: { color: '#34d399', width: 1.5 } },
      { name: 'MA60', type: 'line', data: sma(closes, 60), showSymbol: false, lineStyle: { color: '#a78bfa', width: 1.5 } },
    ],
    animation: false,
  }
}

function buildVolumeChart(bars: StockDailyBar[], name: string, ticker: string, market: 'KR' | 'US', marketLabel: string, generatedAt: string, frame: boolean): EChartsOption {
  const dates = bars.map((b) => b.tradeDate)
  const data = bars.map((b, i) => ({
    value: b.volume,
    itemStyle: { color: i > 0 ? (b.close >= bars[i - 1].close ? COLOR_UP : COLOR_DOWN) : COLOR_FLAT },
  }))
  const subtitle = `${marketLabel} · ${ticker} · ${dates[0]} ~ ${dates[dates.length - 1]} · 적색=상승일 / 청색=하락일`
  const footer = `데이터 출처: ${sourceLabel(market)} · 기준: ${generatedAt} · 참고용`

  return {
    backgroundColor: BG_GRADIENT,
    textStyle: { fontFamily: FONT_FAMILY },
    graphic: frame ? slideFrame(`${name} 거래량`, subtitle, footer) : undefined,
    grid: frame ? COMMON_GRID : RAW_GRID_PLAIN,
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR },
      axisLine: { lineStyle: { color: AXIS_LINE } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: AXIS_LABEL_COLOR,
        formatter: (value: number) =>
          value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(0)}K` : `${value}`,
      },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [{ name: '거래량', type: 'bar', data }],
    animation: false,
  }
}

function buildChangePctChart(bars: StockDailyBar[], name: string, ticker: string, market: 'KR' | 'US', marketLabel: string, generatedAt: string, frame: boolean): EChartsOption {
  const dates = bars.map((b) => b.tradeDate)
  const changes = bars.map((b, i) => calcChangePct(b.close, i > 0 ? bars[i - 1].close : null))
  const valid = changes.filter((c): c is number => c !== null)
  const avg = valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100 : 0
  const upDays = valid.filter((c) => c > 0).length
  const downDays = valid.filter((c) => c < 0).length
  const subtitle = `${marketLabel} · ${ticker} · 상승 ${upDays}일 / 하락 ${downDays}일 / 평균 ${avg >= 0 ? '+' : ''}${avg}%`
  const footer = `데이터 출처: ${sourceLabel(market)} · 기준: ${generatedAt} · 참고용`

  return {
    backgroundColor: BG_GRADIENT,
    textStyle: { fontFamily: FONT_FAMILY },
    graphic: frame ? slideFrame(`${name} 일별 등락률(%)`, subtitle, footer) : undefined,
    grid: frame ? COMMON_GRID : RAW_GRID_PLAIN,
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR },
      axisLine: { lineStyle: { color: AXIS_LINE } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR, formatter: '{value}%' },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [
      {
        name: '전일대비 등락률(%)',
        type: 'bar',
        data: changes.map((c) => ({
          value: c ?? 0,
          itemStyle: { color: c === null ? COLOR_FLAT : c >= 0 ? COLOR_UP : COLOR_DOWN },
        })),
        markLine: {
          symbol: 'none',
          data: [{ yAxis: avg, name: '평균' }],
          lineStyle: { color: ACCENT_GOLD, type: 'dashed' },
          label: {
            formatter: `평균 ${avg >= 0 ? '+' : ''}${avg}%`,
            fontFamily: FONT_FAMILY,
            color: ACCENT_GOLD,
            fontSize: 13,
            position: 'insideStartTop',
            align: 'left',
          },
        },
      },
    ],
    animation: false,
  }
}

/**
 * 추세 시나리오형 — 단일 선형회귀 예측선 대신, 현재가에서 분기하는
 * "긍정/기본/부정" 3개 시나리오 선으로 추세 방향성을 표현 (변동성 기반 분기 폭).
 * "추정 구간" 음영 박스 대신 "현재" 구분선만 표시해 예측 단정 느낌을 완화한다.
 */
function buildTrendScenarioChart(bars: StockDailyBar[], name: string, ticker: string, market: 'KR' | 'US', marketLabel: string, generatedAt: string, frame: boolean): EChartsOption {
  const TREND_WINDOW = Math.min(30, bars.length)
  const FORECAST_DAYS = 10
  const recent = bars.slice(-TREND_WINDOW)
  const closes = recent.map((b) => b.close)
  const { slope, intercept } = linearRegression(closes)
  const volatility = stdDev(closes.map((c, i) => c - (slope * i + intercept)))

  const forecastDates: string[] = []
  let cursor = recent[recent.length - 1].tradeDate
  for (let i = 0; i < FORECAST_DAYS; i++) {
    cursor = addBusinessDays(cursor, 1)
    forecastDates.push(cursor)
  }

  const dates = [...recent.map((b) => b.tradeDate), ...forecastDates]
  const actual: (number | null)[] = [...closes, ...forecastDates.map(() => null)]
  const lastClose = closes[closes.length - 1]
  const anchorIdx = recent.length - 1

  const baseLine: (number | null)[] = []
  const positiveLine: (number | null)[] = []
  const negativeLine: (number | null)[] = []
  dates.forEach((_, i) => {
    if (i < anchorIdx) {
      baseLine.push(null)
      positiveLine.push(null)
      negativeLine.push(null)
      return
    }
    const step = i - anchorIdx
    const base = lastClose + slope * step
    const spread = volatility * Math.sqrt(step) * 1.2
    baseLine.push(Math.round(base * 100) / 100)
    positiveLine.push(Math.round((base + spread) * 100) / 100)
    negativeLine.push(Math.round((base - spread) * 100) / 100)
  })

  const pct = (v: number | null) => v === null ? 0 : Math.round(((v - lastClose) / lastClose) * 10000) / 100
  const basePct = pct(baseLine[baseLine.length - 1])
  const posPct = pct(positiveLine[positiveLine.length - 1])
  const negPct = pct(negativeLine[negativeLine.length - 1])
  const fmtPct = (p: number) => `${p >= 0 ? '+' : ''}${p}%`

  const subtitle = `${marketLabel} · ${ticker} · 최근 ${TREND_WINDOW}거래일 추세 기반 · ${FORECAST_DAYS}거래일 후 시나리오 — 긍정 ${fmtPct(posPct)} / 기본 ${fmtPct(basePct)} / 부정 ${fmtPct(negPct)}`
  const footer = `※ 과거 추세·변동성 기반 시나리오이며 투자 권유·예측이 아닙니다. 실제 가격과 다를 수 있습니다. · 기준: ${generatedAt}`

  return {
    backgroundColor: BG_GRADIENT,
    textStyle: { fontFamily: FONT_FAMILY },
    graphic: frame ? slideFrame(`${name} 추세 시나리오 (참고용)`, subtitle, footer) : undefined,
    legend: {
      top: frame ? HEADER_H + 10 : 10,
      left: 'center',
      data: ['종가', '긍정 시나리오', '기본 시나리오', '부정 시나리오'],
      textStyle: { fontFamily: FONT_FAMILY, color: LEGEND_COLOR, fontSize: 15 },
      itemWidth: 22,
      itemGap: 20,
    },
    grid: frame ? COMMON_GRID : RAW_GRID,
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR },
      axisLine: { lineStyle: { color: AXIS_LINE } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { fontFamily: FONT_FAMILY, fontSize: 13, color: AXIS_LABEL_COLOR },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: [
      {
        name: '종가',
        type: 'line',
        data: actual,
        showSymbol: false,
        lineStyle: { color: '#f8fafc', width: 2.5 },
        markLine: {
          symbol: 'none',
          data: [{ xAxis: dates[anchorIdx], name: '현재' }],
          lineStyle: { color: 'rgba(148, 163, 184, 0.5)', width: 1, type: 'solid' },
          label: { formatter: '현재', fontFamily: FONT_FAMILY, color: AXIS_LABEL_COLOR, fontSize: 12 },
        },
      },
      { name: '긍정 시나리오', type: 'line', data: positiveLine, showSymbol: false, lineStyle: { color: COLOR_UP, width: 2, type: 'dashed' } },
      { name: '기본 시나리오', type: 'line', data: baseLine, showSymbol: false, lineStyle: { color: ACCENT_GOLD, width: 2, type: 'dashed' } },
      { name: '부정 시나리오', type: 'line', data: negativeLine, showSymbol: false, lineStyle: { color: COLOR_DOWN, width: 2, type: 'dashed' } },
    ],
    animation: false,
  }
}

function renderToPng(option: EChartsOption): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT)
  const chart = echarts.init(canvas as unknown as HTMLCanvasElement, undefined, { width: WIDTH, height: HEIGHT })
  chart.setOption(option)
  const buffer = canvas.toBuffer('image/png')
  chart.dispose()
  return buffer
}

export type StockChartIndex = 1 | 2 | 3 | 4

/** 차트 번호별 설명 — 종목 분석 리포트 프롬프트의 "차트 이미지 가이드" 안내에 사용 */
export const STOCK_CHART_LABELS: Record<StockChartIndex, string> = {
  1: '가격 추이 & 이동평균선 (MA5/20/60)',
  2: '거래량 (상승일=적색 / 하락일=청색)',
  3: '일별 등락률(%) + 평균선',
  4: '추세 방향성 분석 (참고용)',
}

/**
 * 차트 번호별 PNG 렌더링: 1=가격&이동평균, 2=거래량, 3=일별등락률, 4=추세 방향성
 * @param frame true(기본)=PPT 장표 스타일(상단 제목바·하단 출처바, slide 출력용), false=차트 단독(chart 출력용, 범례만 유지)
 */
export function renderStockChartPng(
  index: StockChartIndex,
  bars: StockDailyBar[],
  name: string,
  ticker: string,
  market: 'KR' | 'US',
  generatedAt: string,
  frame: boolean = true,
): Buffer {
  const marketLabel = market === 'KR' ? '국내' : '미국'
  const option =
    index === 1 ? buildPriceChart(bars, name, ticker, market, marketLabel, generatedAt, frame)
    : index === 2 ? buildVolumeChart(bars, name, ticker, market, marketLabel, generatedAt, frame)
    : index === 3 ? buildChangePctChart(bars, name, ticker, market, marketLabel, generatedAt, frame)
    : buildTrendScenarioChart(bars, name, ticker, market, marketLabel, generatedAt, frame)
  return renderToPng(option)
}
