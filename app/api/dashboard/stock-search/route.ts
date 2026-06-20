import { NextRequest, NextResponse } from 'next/server'
import { searchKrStockDirectory } from '@/lib/dashboard/kr-stock-directory'
import { searchAlphaVantageSymbol } from '@/lib/data/alpha-vantage-stock'

export interface StockSearchResultItem {
  ticker: string
  name: string
}

/**
 * KR 종목 검색: 네이버 증권 자동완성 API (키 불필요, 한글 검색 지원).
 * 실패 시 정적 큐레이션 디렉토리로 폴백.
 */
async function searchNaverKrStocks(q: string): Promise<StockSearchResultItem[]> {
  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&q_enc=UTF-8&st=111&target=stock&lang=ko`
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      items?: { code?: string; name?: string; typeCode?: string; category?: string }[]
    }
    return (data.items ?? [])
      .filter((item) => item.code && item.name && item.category === 'stock')
      .map((item) => ({ ticker: item.code!, name: item.name! }))
      .slice(0, 12)
  } catch {
    return []
  }
}

/**
 * US 종목 검색: Yahoo Finance v1 search (키 불필요).
 * 미국 거래소 종목(심볼에 . 없음)만 반환, Equity·ETF 필터.
 * 실패 시 빈 배열 반환.
 */
async function searchYahooUsStocks(q: string): Promise<StockSearchResultItem[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      quotes?: {
        symbol?: string
        shortname?: string
        longname?: string
        typeDisp?: string
        exchDisp?: string
      }[]
    }
    return (data.quotes ?? [])
      .filter((item) =>
        item.symbol &&
        (item.typeDisp === 'Equity' || item.typeDisp === 'ETF') &&
        (item.shortname || item.longname) &&
        !item.symbol.includes('.'),  // 미국 상장 종목은 . 없음 (.KS, .HK 등 제외)
      )
      .map((item) => ({ ticker: item.symbol!, name: item.shortname ?? item.longname ?? item.symbol! }))
      .slice(0, 10)
  } catch {
    return []
  }
}

/**
 * 종목 검색
 * - KR: 네이버 증권 자동완성(한글 전종목) → 큐레이션 디렉토리 폴백
 * - US: Yahoo Finance(키 불필요) → Alpha Vantage 폴백(키 있을 때만)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') === 'US' ? 'US' : 'KR'
  const q = (searchParams.get('q') ?? '').trim()

  if (!q) {
    return NextResponse.json({ results: [] satisfies StockSearchResultItem[] })
  }

  if (market === 'KR') {
    let results = await searchNaverKrStocks(q)
    if (results.length === 0) {
      // 폴백: 큐레이션 디렉토리 (55개 대형주 + 종목코드 직접 검색)
      results = searchKrStockDirectory(q).map(({ ticker, name }) => ({ ticker, name }))
    }
    return NextResponse.json({ results })
  }

  // US: Yahoo Finance 우선
  let results = await searchYahooUsStocks(q)
  if (results.length === 0) {
    // 폴백: Alpha Vantage (ALPHA_VANTAGE_API_KEY 설정 시)
    const fallback = await searchAlphaVantageSymbol(q)
    if (fallback.ok) {
      results = (fallback.results ?? []).map((r) => ({ ticker: r.symbol, name: r.name }))
    }
  }
  return NextResponse.json({ results })
}
