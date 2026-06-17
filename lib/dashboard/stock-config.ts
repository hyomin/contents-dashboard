export type StockMarket = 'KR' | 'US'
export type StockAssetType = 'stock' | 'index'

export interface StockWatchlistSeed {
  ticker: string
  market: StockMarket
  assetType: StockAssetType
  name: string
}

/** 초기 워치리스트 — 주요 지수 + 대형주 소수 (대시보드 «워치리스트» 화면에서 추가·삭제 가능) */
export const DEFAULT_STOCK_WATCHLIST: StockWatchlistSeed[] = [
  { ticker: '0001', market: 'KR', assetType: 'index', name: 'KOSPI' },
  { ticker: '1001', market: 'KR', assetType: 'index', name: 'KOSDAQ' },
  { ticker: '005930', market: 'KR', assetType: 'stock', name: '삼성전자' },
  { ticker: '000660', market: 'KR', assetType: 'stock', name: 'SK하이닉스' },
  { ticker: '035420', market: 'KR', assetType: 'stock', name: 'NAVER' },
  { ticker: 'SPY', market: 'US', assetType: 'index', name: 'S&P 500 (SPY)' },
  { ticker: 'QQQ', market: 'US', assetType: 'index', name: 'Nasdaq 100 (QQQ)' },
  { ticker: 'AAPL', market: 'US', assetType: 'stock', name: 'Apple' },
  { ticker: 'NVDA', market: 'US', assetType: 'stock', name: 'NVIDIA' },
  { ticker: 'MSFT', market: 'US', assetType: 'stock', name: 'Microsoft' },
]

export function stockWatchlistId(market: StockMarket, ticker: string): string {
  return `${market}:${ticker}`
}

const DEFAULT_LOOKBACK_DAYS = 60

/** 주식 시세 수집: 종목당 과거 N일치 일별 시세 (기본 60일, 패턴분석용) */
export function getStockCollectLookbackDays(): number {
  const raw = process.env.STOCK_COLLECT_LOOKBACK_DAYS?.trim()
  if (!raw) return DEFAULT_LOOKBACK_DAYS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LOOKBACK_DAYS
  return Math.min(n, 365)
}
