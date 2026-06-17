import type { StockDailyBar } from '@/lib/data/naver-finance-stock'

export interface AlphaVantageFetchResult {
  ok: boolean
  reason?: 'not_configured' | 'request_failed' | 'rate_limited'
  message?: string
  bars?: StockDailyBar[]
}

export interface AlphaVantageSymbolSearchResult {
  ok: boolean
  reason?: 'not_configured' | 'request_failed' | 'rate_limited'
  message?: string
  results?: { symbol: string; name: string }[]
}

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query'

/** 미국 주식·ETF 일별 시세 (TIME_SERIES_DAILY) */
export async function fetchAlphaVantageDailySeries(symbol: string, days: number): Promise<AlphaVantageFetchResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', message: 'ALPHA_VANTAGE_API_KEY 미설정' }
  }

  const params = new URLSearchParams({
    function: 'TIME_SERIES_DAILY',
    symbol,
    outputsize: days > 100 ? 'full' : 'compact',
    apikey: apiKey,
  })

  try {
    const res = await fetch(`${ALPHA_VANTAGE_BASE_URL}?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return { ok: false, reason: 'request_failed', message: `Alpha Vantage API ${res.status}` }
    }
    const data = await res.json()

    if (typeof data.Note === 'string' || typeof data.Information === 'string') {
      return { ok: false, reason: 'rate_limited', message: String(data.Note ?? data.Information) }
    }

    const series = data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined
    if (!series) {
      return { ok: false, reason: 'request_failed', message: 'Time Series (Daily) 응답 없음' }
    }

    const bars: StockDailyBar[] = Object.entries(series)
      .map(([tradeDate, v]): StockDailyBar => ({
        tradeDate,
        open: Number(v['1. open'] ?? 0),
        high: Number(v['2. high'] ?? 0),
        low: Number(v['3. low'] ?? 0),
        close: Number(v['4. close'] ?? 0),
        volume: Number(v['5. volume'] ?? 0),
      }))
      .sort((a, b) => (a.tradeDate < b.tradeDate ? 1 : -1))
      .slice(0, days)

    return { ok: true, bars }
  } catch (err) {
    return { ok: false, reason: 'request_failed', message: err instanceof Error ? err.message : 'Alpha Vantage 요청 실패' }
  }
}

/** 회사명/심볼 검색 (SYMBOL_SEARCH) — 미국(US) 종목 우선 최대 8개 */
export async function searchAlphaVantageSymbol(keyword: string): Promise<AlphaVantageSymbolSearchResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', message: 'ALPHA_VANTAGE_API_KEY 미설정' }
  }

  const params = new URLSearchParams({
    function: 'SYMBOL_SEARCH',
    keywords: keyword,
    apikey: apiKey,
  })

  try {
    const res = await fetch(`${ALPHA_VANTAGE_BASE_URL}?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return { ok: false, reason: 'request_failed', message: `Alpha Vantage API ${res.status}` }
    }
    const data = await res.json()

    if (typeof data.Note === 'string' || typeof data.Information === 'string') {
      return { ok: false, reason: 'rate_limited', message: String(data.Note ?? data.Information) }
    }

    const matches = Array.isArray(data.bestMatches) ? (data.bestMatches as Record<string, string>[]) : []
    const parsed = matches.map((m) => ({
      symbol: String(m['1. symbol'] ?? ''),
      name: String(m['2. name'] ?? ''),
      region: String(m['4. region'] ?? ''),
    })).filter((m) => m.symbol && m.name)

    const usFirst = [...parsed].sort((a, b) => {
      const aUs = a.region === 'United States' ? 0 : 1
      const bUs = b.region === 'United States' ? 0 : 1
      return aUs - bUs
    })

    return { ok: true, results: usFirst.slice(0, 8).map(({ symbol, name }) => ({ symbol, name })) }
  } catch (err) {
    return { ok: false, reason: 'request_failed', message: err instanceof Error ? err.message : 'Alpha Vantage 검색 실패' }
  }
}
