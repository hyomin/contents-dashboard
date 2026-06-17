import { supabase } from '@/lib/data/supabase'
import { fetchNaverDailySeries, type StockDailyBar } from '@/lib/data/naver-finance-stock'
import { fetchAlphaVantageDailySeries } from '@/lib/data/alpha-vantage-stock'
import {
  DEFAULT_STOCK_WATCHLIST,
  getStockCollectLookbackDays,
  stockWatchlistId,
  type StockAssetType,
  type StockMarket,
} from '@/lib/dashboard/stock-config'

export interface StockWatchlistRow {
  id: string
  ticker: string
  market: StockMarket
  asset_type: StockAssetType
  name: string
  sort_order: number
}

export interface StockCollectTickerResult {
  ticker: string
  market: StockMarket
  ok: boolean
  savedCount?: number
  reason?: string
}

export interface StockCollectResult {
  ok: boolean
  savedCount: number
  perTicker: StockCollectTickerResult[]
  message: string
}

/** `stock_watchlist`이 비어있으면 기본 워치리스트로 시드 */
export async function getStockWatchlist(): Promise<StockWatchlistRow[]> {
  const { data, error } = await supabase
    .from('stock_watchlist')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('getStockWatchlist error:', error)
    return []
  }

  if (data && data.length > 0) {
    return data as StockWatchlistRow[]
  }

  const seedRows = DEFAULT_STOCK_WATCHLIST.map((seed, i) => ({
    id: stockWatchlistId(seed.market, seed.ticker),
    ticker: seed.ticker,
    market: seed.market,
    asset_type: seed.assetType,
    name: seed.name,
    sort_order: i,
  }))

  const { error: seedError } = await supabase.from('stock_watchlist').upsert(seedRows, { onConflict: 'id' })
  if (seedError) {
    console.error('getStockWatchlist seed error:', seedError)
    return seedRows
  }
  return seedRows
}

export function calcChangePct(close: number, prevClose: number | null): number | null {
  if (prevClose === null || prevClose === 0) return null
  return ((close - prevClose) / prevClose) * 100
}

/** 워치리스트 전 종목의 일별 시세를 수집해 `stock_daily_snapshots`에 upsert */
export async function runStockCollect(): Promise<StockCollectResult> {
  const watchlist = await getStockWatchlist()
  if (watchlist.length === 0) {
    return { ok: false, savedCount: 0, perTicker: [], message: '워치리스트가 비어 있습니다.' }
  }

  const days = getStockCollectLookbackDays()
  const perTicker: StockCollectTickerResult[] = []
  const rows: Record<string, unknown>[] = []

  for (const item of watchlist) {
    const result = item.market === 'KR'
      ? await fetchNaverDailySeries(item.ticker, item.asset_type, days)
      : await fetchAlphaVantageDailySeries(item.ticker, days)

    if (!result.ok || !result.bars) {
      perTicker.push({ ticker: item.ticker, market: item.market, ok: false, reason: result.reason ?? 'unknown' })
      continue
    }

    const bars = [...result.bars].sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
    bars.forEach((bar, i) => {
      const prevClose = i > 0 ? bars[i - 1].close : null
      rows.push({
        ticker: item.ticker,
        market: item.market,
        trade_date: bar.tradeDate,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        change_pct: calcChangePct(bar.close, prevClose),
        raw: bar,
      })
    })
    perTicker.push({ ticker: item.ticker, market: item.market, ok: true, savedCount: bars.length })
  }

  if (rows.length === 0) {
    return {
      ok: false,
      savedCount: 0,
      perTicker,
      message: '수집된 시세가 없습니다. ALPHA_VANTAGE_API_KEY 설정을 확인하세요 (국내 종목은 네이버 금융 API 사용, 키 불필요).',
    }
  }

  const { error } = await supabase.from('stock_daily_snapshots').upsert(rows, { onConflict: 'ticker,trade_date' })
  if (error) {
    console.error('runStockCollect upsert error:', error)
    return { ok: false, savedCount: 0, perTicker, message: `저장 실패: ${error.message}` }
  }

  return { ok: true, savedCount: rows.length, perTicker, message: `${rows.length}건 저장 완료` }
}

export interface StockLatestSnapshot {
  ticker: string
  market: StockMarket
  name: string
  assetType: StockAssetType
  tradeDate: string
  close: number | null
  changePct: number | null
}

/** 워치리스트별 최신 스냅샷 (대시보드 요약 카드용) */
export async function getLatestStockSnapshots(): Promise<StockLatestSnapshot[]> {
  const watchlist = await getStockWatchlist()
  if (watchlist.length === 0) return []

  const tickers = watchlist.map((w) => w.ticker)
  const { data, error } = await supabase
    .from('stock_daily_snapshots')
    .select('ticker, market, trade_date, close, change_pct')
    .in('ticker', tickers)
    .order('trade_date', { ascending: false })

  if (error) {
    console.error('getLatestStockSnapshots error:', error)
    return []
  }

  const latestByTicker = new Map<string, { trade_date: string; close: number | null; change_pct: number | null }>()
  for (const row of data ?? []) {
    if (!latestByTicker.has(row.ticker)) {
      latestByTicker.set(row.ticker, row)
    }
  }

  return watchlist.map((w) => {
    const snap = latestByTicker.get(w.ticker)
    return {
      ticker: w.ticker,
      market: w.market,
      name: w.name,
      assetType: w.asset_type,
      tradeDate: snap?.trade_date ?? '',
      close: snap?.close ?? null,
      changePct: snap?.change_pct ?? null,
    }
  })
}

export interface StockSeriesForPrompt {
  ticker: string
  market: StockMarket
  name: string
  assetType: StockAssetType
  bars: { tradeDate: string; open: number; close: number; changePct: number | null }[]
}

/** 리포트 생성 프롬프트용 — 워치리스트별 최근 N일 시세 시리즈 */
export async function getStockSeriesForReport(days = 20): Promise<StockSeriesForPrompt[]> {
  const watchlist = await getStockWatchlist()
  if (watchlist.length === 0) return []

  const tickers = watchlist.map((w) => w.ticker)
  const { data, error } = await supabase
    .from('stock_daily_snapshots')
    .select('ticker, trade_date, open, close, change_pct')
    .in('ticker', tickers)
    .order('trade_date', { ascending: false })
    .limit(tickers.length * days)

  if (error) {
    console.error('getStockSeriesForReport error:', error)
    return []
  }

  const byTicker = new Map<string, { tradeDate: string; open: number; close: number; changePct: number | null }[]>()
  for (const row of data ?? []) {
    const list = byTicker.get(row.ticker) ?? []
    if (list.length < days) {
      list.push({ tradeDate: row.trade_date, open: Number(row.open), close: Number(row.close), changePct: row.change_pct !== null ? Number(row.change_pct) : null })
    }
    byTicker.set(row.ticker, list)
  }

  return watchlist.map((w) => ({
    ticker: w.ticker,
    market: w.market,
    name: w.name,
    assetType: w.asset_type,
    bars: (byTicker.get(w.ticker) ?? []).sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1)),
  }))
}

/** 차트 렌더링용 — 특정 종목의 최근 N일 OHLCV (오래된→최신 정렬). W11이 적재한 stock_daily_snapshots를 그대로 사용 */
export async function getStockBarsForChart(ticker: string, market: StockMarket, days = 120): Promise<StockDailyBar[]> {
  const { data, error } = await supabase
    .from('stock_daily_snapshots')
    .select('trade_date, open, high, low, close, volume')
    .eq('ticker', ticker)
    .eq('market', market)
    .order('trade_date', { ascending: false })
    .limit(days)

  if (error) {
    console.error('getStockBarsForChart error:', error)
    return []
  }

  return (data ?? [])
    .map((row) => ({
      tradeDate: row.trade_date,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume),
    }))
    .sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
}
