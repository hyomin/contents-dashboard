import type { StockAssetType } from '@/lib/dashboard/stock-config'

export interface StockDailyBar {
  tradeDate: string // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface NaverFetchResult {
  ok: boolean
  reason?: 'request_failed'
  message?: string
  bars?: StockDailyBar[]
}

const NAVER_CHART_URL = 'https://fchart.stock.naver.com/sise.nhn'
const NAVER_WORLD_URL = 'https://api.stock.naver.com/stock'
const NAVER_WORLD_MAX_PAGE_SIZE = 60

/** 워치리스트의 KIS 지수 코드 → 네이버 금융 차트 심볼 */
const INDEX_SYMBOL_MAP: Record<string, string> = {
  '0001': 'KOSPI',
  '1001': 'KOSDAQ',
}

/**
 * 미국 종목 심볼 suffix 탐지 순서.
 * 대부분의 NASDAQ 종목은 .O, NYSE ARCA ETF(SPY 등)는 suffix 없음, NYSE는 .N, AMEX는 .K
 */
const US_SUFFIXES = ['.O', '', '.N', '.K']

/** 종목별 suffix 인메모리 캐시 (프로세스 내 반복 탐지 방지) */
const suffixCache = new Map<string, string>()

/** 미국 종목 ticker → 네이버 해외주식 심볼 (suffix 자동 탐지, 캐시) */
async function resolveNaverWorldSymbol(ticker: string): Promise<string | null> {
  if (suffixCache.has(ticker)) return suffixCache.get(ticker)!

  for (const suffix of US_SUFFIXES) {
    const symbol = `${ticker}${suffix}`
    try {
      const res = await fetch(`${NAVER_WORLD_URL}/${encodeURIComponent(symbol)}/price?pageSize=1`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      })
      if (!res.ok) continue
      const data = await res.json() as unknown[]
      if (Array.isArray(data) && data.length > 0) {
        suffixCache.set(ticker, symbol)
        return symbol
      }
    } catch { /* suffix 탐지 실패 → 다음 suffix 시도 */ }
  }
  return null
}

/**
 * 국내 종목·지수 일별 시세 (네이버 금융 비공식 차트 API).
 * - 별도 API 키 발급 불필요.
 * - 종목: 6자리 종목코드 그대로 사용. 지수: KOSPI/KOSDAQ 심볼로 매핑.
 */
export async function fetchNaverDailySeries(
  ticker: string,
  assetType: StockAssetType,
  days: number,
): Promise<NaverFetchResult> {
  const symbol = assetType === 'index' ? (INDEX_SYMBOL_MAP[ticker] ?? ticker) : ticker

  const params = new URLSearchParams({
    symbol,
    timeframe: 'day',
    count: String(days),
    requestType: '0',
  })

  try {
    const res = await fetch(`${NAVER_CHART_URL}?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return { ok: false, reason: 'request_failed', message: `네이버 금융 API ${res.status}` }
    }

    const xml = await res.text()
    const bars: StockDailyBar[] = []
    for (const match of xml.matchAll(/<item data="([^"]+)"/g)) {
      const parts = match[1].split('|')
      if (parts.length < 6) continue
      const [rawDate, open, high, low, close, volume] = parts
      if (!/^\d{8}$/.test(rawDate)) continue
      bars.push({
        tradeDate: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      })
    }

    if (bars.length === 0) {
      return { ok: false, reason: 'request_failed', message: `시세 데이터 없음 (symbol=${symbol})` }
    }
    return { ok: true, bars }
  } catch (err) {
    return { ok: false, reason: 'request_failed', message: err instanceof Error ? err.message : '네이버 금융 요청 실패' }
  }
}

/**
 * 미국/해외 종목 일별 시세 (네이버 증권 해외주식 API).
 * - API 키 불필요, 최대 60일치 데이터.
 * - volume 정보 없음 (0으로 채움).
 * - suffix 자동 탐지: .O(NASDAQ) → no-suffix(NYSE ARCA/ETF) → .N(NYSE) → .K(AMEX)
 */
export async function fetchNaverWorldDailySeries(
  ticker: string,
  days: number,
): Promise<NaverFetchResult> {
  const pageSize = Math.min(days, NAVER_WORLD_MAX_PAGE_SIZE)

  const symbol = await resolveNaverWorldSymbol(ticker)
  if (!symbol) {
    return {
      ok: false,
      reason: 'request_failed',
      message: `네이버 증권에서 ${ticker} 종목을 찾을 수 없습니다 (시도: ${US_SUFFIXES.map((s) => ticker + s || ticker).join(', ')})`,
    }
  }

  try {
    const res = await fetch(`${NAVER_WORLD_URL}/${encodeURIComponent(symbol)}/price?pageSize=${pageSize}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    if (!res.ok) {
      return { ok: false, reason: 'request_failed', message: `네이버 해외주식 API ${res.status} (${symbol})` }
    }

    const data = (await res.json()) as {
      localTradedAt?: string
      openPrice?: string
      highPrice?: string
      lowPrice?: string
      closePrice?: string
    }[]

    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, reason: 'request_failed', message: `시세 데이터 없음 (symbol=${symbol})` }
    }

    const bars: StockDailyBar[] = data
      .filter((row) => row.localTradedAt && row.closePrice)
      .map((row) => ({
        tradeDate: row.localTradedAt!.slice(0, 10),
        open: Number(row.openPrice ?? row.closePrice ?? 0),
        high: Number(row.highPrice ?? row.closePrice ?? 0),
        low: Number(row.lowPrice ?? row.closePrice ?? 0),
        close: Number(row.closePrice!),
        volume: 0,
      }))
      .sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))

    return { ok: true, bars }
  } catch (err) {
    return { ok: false, reason: 'request_failed', message: err instanceof Error ? err.message : '네이버 해외주식 요청 실패' }
  }
}
