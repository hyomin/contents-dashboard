export type StockMarket = 'KR' | 'US'
export type StockAssetType = 'stock' | 'index'

export interface StockWatchlistSeed {
  ticker: string
  market: StockMarket
  assetType: StockAssetType
  name: string
}

/** 한국 주식시장 정규장 마감 시각 (KST) */
export const KR_MARKET_CLOSE_KST = '15:30'

/**
 * [지수 지표] 섹션에 항상 고정 표시되는 주요 글로벌 지수.
 * KR 지수는 네이버 금융 API로 실시간 조회(키 불필요),
 * US 지수는 stock_daily_snapshots 캐시 조회(Alpha Vantage 수집 시에만 표시).
 */
export const FIXED_INDEX_LIST: StockWatchlistSeed[] = [
  // KR 주요 지수
  { ticker: '0001', market: 'KR', assetType: 'index', name: 'KOSPI' },
  { ticker: '1001', market: 'KR', assetType: 'index', name: 'KOSDAQ' },
  // US 주요 ETF 대리 지수
  { ticker: 'SPY', market: 'US', assetType: 'index', name: 'S&P 500' },
  { ticker: 'QQQ', market: 'US', assetType: 'index', name: 'NASDAQ 100' },
  { ticker: 'DIA', market: 'US', assetType: 'index', name: 'Dow Jones' },
  { ticker: 'IWM', market: 'US', assetType: 'index', name: 'Russell 2000' },
]

/**
 * 초기 워치리스트 — 지수(시세 수집용) + KR 대형주 7개 + US 대형주 7개.
 * stock_watchlist 테이블이 비어있을 때만 시드됩니다.
 */
export const DEFAULT_STOCK_WATCHLIST: StockWatchlistSeed[] = [
  // KR 지수 (시세 수집용 — 지수 지표 섹션에도 사용)
  { ticker: '0001', market: 'KR', assetType: 'index', name: 'KOSPI' },
  { ticker: '1001', market: 'KR', assetType: 'index', name: 'KOSDAQ' },
  // KR 대형주 7개
  { ticker: '005930', market: 'KR', assetType: 'stock', name: '삼성전자' },
  { ticker: '000660', market: 'KR', assetType: 'stock', name: 'SK하이닉스' },
  { ticker: '035420', market: 'KR', assetType: 'stock', name: 'NAVER' },
  { ticker: '005380', market: 'KR', assetType: 'stock', name: '현대차' },
  { ticker: '035720', market: 'KR', assetType: 'stock', name: '카카오' },
  { ticker: '373220', market: 'KR', assetType: 'stock', name: 'LG에너지솔루션' },
  { ticker: '012450', market: 'KR', assetType: 'stock', name: '한화에어로스페이스' },
  // US 지수 (시세 수집용 — 지수 지표 섹션에도 사용, Alpha Vantage 키 필요)
  { ticker: 'SPY', market: 'US', assetType: 'index', name: 'S&P 500 (SPY)' },
  { ticker: 'QQQ', market: 'US', assetType: 'index', name: 'Nasdaq 100 (QQQ)' },
  // US 대형주 7개 (Alpha Vantage 키 필요)
  { ticker: 'AAPL', market: 'US', assetType: 'stock', name: 'Apple' },
  { ticker: 'NVDA', market: 'US', assetType: 'stock', name: 'NVIDIA' },
  { ticker: 'MSFT', market: 'US', assetType: 'stock', name: 'Microsoft' },
  { ticker: 'TSLA', market: 'US', assetType: 'stock', name: 'Tesla' },
  { ticker: 'AMZN', market: 'US', assetType: 'stock', name: 'Amazon' },
  { ticker: 'GOOGL', market: 'US', assetType: 'stock', name: 'Alphabet' },
  { ticker: 'META', market: 'US', assetType: 'stock', name: 'Meta' },
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
