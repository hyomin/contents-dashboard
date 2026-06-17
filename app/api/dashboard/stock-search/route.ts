import { NextRequest, NextResponse } from 'next/server'
import { searchKrStockDirectory } from '@/lib/dashboard/kr-stock-directory'
import { searchAlphaVantageSymbol } from '@/lib/data/alpha-vantage-stock'

export interface StockSearchResultItem {
  ticker: string
  name: string
}

/** 종목 검색 — KR: 큐레이션 디렉토리, US: Alpha Vantage SYMBOL_SEARCH (읽기 전용, 인증 불필요) */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') === 'US' ? 'US' : 'KR'
  const q = (searchParams.get('q') ?? '').trim()

  if (!q) {
    return NextResponse.json({ results: [] satisfies StockSearchResultItem[] })
  }

  if (market === 'KR') {
    const results = searchKrStockDirectory(q).map(({ ticker, name }) => ({ ticker, name }))
    return NextResponse.json({ results })
  }

  const searched = await searchAlphaVantageSymbol(q)
  if (!searched.ok) {
    return NextResponse.json({ results: [] satisfies StockSearchResultItem[], reason: searched.reason })
  }
  const results: StockSearchResultItem[] = (searched.results ?? []).map((r) => ({ ticker: r.symbol, name: r.name }))
  return NextResponse.json({ results })
}
