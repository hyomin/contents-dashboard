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

/** 워치리스트의 KIS 지수 코드 → 네이버 금융 차트 심볼 */
const INDEX_SYMBOL_MAP: Record<string, string> = {
  '0001': 'KOSPI',
  '1001': 'KOSDAQ',
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
