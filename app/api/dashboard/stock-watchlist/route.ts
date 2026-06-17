import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'
import { getStockWatchlist } from '@/lib/data/stock-collect'
import { stockWatchlistId, type StockAssetType, type StockMarket } from '@/lib/dashboard/stock-config'
import { parseJsonBody } from '@/lib/utils/request'

export async function GET() {
  const watchlist = await getStockWatchlist()
  return NextResponse.json({ watchlist, count: watchlist.length })
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request)
  const ticker = typeof body.ticker === 'string' ? body.ticker.trim() : ''
  const market = body.market === 'US' ? 'US' : body.market === 'KR' ? 'KR' : null
  const assetType: StockAssetType = body.assetType === 'index' ? 'index' : 'stock'
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!ticker || !market || !name) {
    return NextResponse.json({ error: 'ticker, market, name이 필요합니다.' }, { status: 400 })
  }

  const { data: existing } = await supabase.from('stock_watchlist').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const row = {
    id: stockWatchlistId(market as StockMarket, ticker),
    ticker,
    market,
    asset_type: assetType,
    name,
    sort_order: nextOrder,
  }

  const { error } = await supabase.from('stock_watchlist').upsert(row, { onConflict: 'id' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, item: row })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  const { error } = await supabase.from('stock_watchlist').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
