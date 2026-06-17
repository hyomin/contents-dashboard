/**
 * 주식 차트 이미지 생성 — 종목 검색 → 시세 조회 → 다각도 분석 PNG 4종 출력
 *
 * 사용:
 *   npx tsx scripts/stock-chart-export.ts --market=KR --query=삼성전자
 *   npx tsx scripts/stock-chart-export.ts --market=US --query=Tesla
 *   npx tsx scripts/stock-chart-export.ts --market=KR --ticker=005930 --name=삼성전자 --days=120
 *   npx tsx scripts/stock-chart-export.ts --market=KR --query=삼성전자 --mock   (API 키 없이 파이프라인 점검)
 *   npx tsx scripts/stock-chart-export.ts --market=KR --query=삼성전자 --mock --frame=chart  (chart만)
 *
 * 출력: stock/<YYYY-MM-DD>/research/<chart|slide>/{종목명}-<1~4>.png
 *   1: 가격 추이 & 이동평균선(MA5/20/60)
 *   2: 거래량 (상승일=적색 / 하락일=청색)
 *   3: 일별 등락률(%) + 평균선
 *   4: 추세선 & 향후 전망(선형회귀 추정, 참고용)
 *
 * 차트 렌더링 코어는 lib/dashboard/stock-chart-render.ts에 있으며,
 * app/api/dashboard/stock-report-focus(종목 분석 리포트 API)에서도 동일 코어를 공유한다.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNaverDailySeries, type StockDailyBar } from '../lib/data/naver-finance-stock'
import { fetchAlphaVantageDailySeries, searchAlphaVantageSymbol } from '../lib/data/alpha-vantage-stock'
import { searchKrStockDirectory } from '../lib/dashboard/kr-stock-directory'
import { renderStockChartPng, type StockChartIndex } from '../lib/dashboard/stock-chart-render'
import { resolveStockOutputDir, stockChartFileName } from '../lib/dashboard/stock-output-paths'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnvLocal(): void {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

type FrameMode = 'chart' | 'slide' | 'both'

interface CliArgs {
  market: 'KR' | 'US'
  ticker?: string
  name?: string
  query?: string
  days: number
  mock: boolean
  frame: FrameMode
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>()
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (m) map.set(m[1], m[2] ?? 'true')
  }
  const frame = map.get('frame')
  return {
    market: map.get('market') === 'US' ? 'US' : 'KR',
    ticker: map.get('ticker'),
    name: map.get('name'),
    query: map.get('query'),
    days: Number(map.get('days') ?? 120),
    mock: map.get('mock') === 'true',
    frame: frame === 'chart' || frame === 'slide' ? frame : 'both',
  }
}

/** API 키 없이 렌더링 파이프라인을 점검하기 위한 임의 시세 데이터 (재현 가능한 시드 기반) */
function buildMockBars(days: number): StockDailyBar[] {
  const bars: StockDailyBar[] = []
  let price = 70000
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const cursor = new Date()
  cursor.setDate(cursor.getDate() - days)
  while (bars.length < days) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) {
      const drift = (rand() - 0.48) * 0.02
      price = Math.max(1000, price * (1 + drift))
      const open = price * (1 + (rand() - 0.5) * 0.01)
      const high = Math.max(open, price) * (1 + rand() * 0.01)
      const low = Math.min(open, price) * (1 - rand() * 0.01)
      bars.push({
        tradeDate: cursor.toISOString().slice(0, 10),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(price),
        volume: Math.round(500_000 + rand() * 1_500_000),
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return bars
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  let ticker = args.ticker
  let name = args.name

  if (!ticker && args.query) {
    if (args.market === 'KR') {
      const matches = searchKrStockDirectory(args.query, 1)
      if (matches.length === 0) {
        console.error(`[KR] "${args.query}"에 대한 검색 결과가 없습니다. --ticker/--name으로 직접 지정해주세요.`)
        process.exit(1)
      }
      ticker = matches[0].ticker
      name = matches[0].name
    } else {
      const searched = await searchAlphaVantageSymbol(args.query)
      if (!searched.ok || !searched.results?.length) {
        console.error(`[US] "${args.query}" 검색 실패 (${searched.reason ?? 'no_results'}). --ticker/--name으로 직접 지정해주세요.`)
        process.exit(1)
      }
      ticker = searched.results[0].symbol
      name = searched.results[0].name
    }
  }

  if (!ticker) {
    console.error('사용법: npx tsx scripts/stock-chart-export.ts --market=KR|US (--query=검색어 | --ticker=코드 [--name=종목명]) [--days=120] [--mock]')
    process.exit(1)
  }
  name = name ?? ticker

  let bars: StockDailyBar[]
  if (args.mock) {
    bars = buildMockBars(args.days)
    console.log('⚠ --mock 모드: API 호출 없이 임의 데이터로 렌더링 파이프라인만 점검합니다.')
  } else {
    const result = args.market === 'KR'
      ? await fetchNaverDailySeries(ticker, 'stock', args.days)
      : await fetchAlphaVantageDailySeries(ticker, args.days)
    if (!result.ok || !result.bars || result.bars.length === 0) {
      console.error(`시세 데이터를 가져오지 못했습니다: ${result.reason ?? 'unknown'} ${result.message ?? ''}`)
      console.error('API 키 설정 없이 파이프라인만 점검하려면 --mock 옵션을 추가하세요.')
      process.exit(1)
    }
    bars = [...result.bars].sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
  }

  if (bars.length < 5) {
    console.error('데이터가 너무 적습니다 (최소 5거래일 필요).')
    process.exit(1)
  }

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const generatedAt = `${today} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const indexes: StockChartIndex[] = [1, 2, 3, 4]
  const variants: { variant: 'chart' | 'slide'; frame: boolean }[] = []
  if (args.frame === 'chart' || args.frame === 'both') variants.push({ variant: 'chart', frame: false })
  if (args.frame === 'slide' || args.frame === 'both') variants.push({ variant: 'slide', frame: true })

  for (const { variant, frame } of variants) {
    const outDir = resolveStockOutputDir(today, 'research', variant)
    for (const index of indexes) {
      const buffer = renderStockChartPng(index, bars, name, ticker, args.market, generatedAt, frame)
      const fileName = stockChartFileName(name, index)
      const filePath = resolve(outDir, fileName)
      writeFileSync(filePath, buffer)
      console.log(`✅ ${filePath}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
