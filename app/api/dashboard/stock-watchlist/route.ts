import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'
import { getStockWatchlist } from '@/lib/data/stock-collect'
import { fetchNaverDailySeries, fetchNaverWorldDailySeries } from '@/lib/data/naver-finance-stock'
import { stockWatchlistId, type StockAssetType, type StockMarket } from '@/lib/dashboard/stock-config'
import { parseJsonBody } from '@/lib/utils/request'

/** KST 기준 오늘 날짜 */
function todayKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** 스냅샷이 신선한지 확인 — 오늘 또는 어제(주말 고려해 2일 이내) */
function isFresh(tradeDate: string | null | undefined): boolean {
  if (!tradeDate) return false
  const today = new Date(todayKst())
  const date = new Date(tradeDate)
  const diffDays = (today.getTime() - date.getTime()) / 86_400_000
  return diffDays <= 3 // 주말·공휴일 고려해 3일 이내면 신선
}

/** 단일 종목 최신 2일 시세를 네이버 API로 직접 조회 → close / changePct / tradeDate 반환 */
async function fetchLivePrice(
  ticker: string,
  market: StockMarket,
  assetType: StockAssetType,
): Promise<{ close: number | null; changePct: number | null; tradeDate: string }> {
  const result = market === 'KR'
    ? await fetchNaverDailySeries(ticker, assetType, 2)
    : await fetchNaverWorldDailySeries(ticker, 2)

  if (!result.ok || !result.bars || result.bars.length === 0) {
    return { close: null, changePct: null, tradeDate: '' }
  }

  const sorted = [...result.bars].sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
  const latest = sorted[sorted.length - 1]
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null

  const changePct = prev && prev.close !== 0
    ? ((latest.close - prev.close) / prev.close) * 100
    : null

  // DB에 최신 스냅샷 저장 (fire & forget — 리포트 생성 시 활용)
  void supabase.from('stock_daily_snapshots').upsert(
    {
      ticker,
      market,
      trade_date: latest.tradeDate,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
      volume: latest.volume,
      change_pct: changePct,
      raw: latest,
    },
    { onConflict: 'ticker,trade_date' },
  )

  return { close: latest.close, changePct, tradeDate: latest.tradeDate }
}

export async function GET() {
  const watchlist = await getStockWatchlist()
  const stockItems = watchlist.filter((w) => w.asset_type === 'stock')

  // 1. DB에서 최신 스냅샷 조회
  const krTickers = stockItems.filter((w) => w.market === 'KR').map((w) => w.ticker)
  const usTickers = stockItems.filter((w) => w.market === 'US').map((w) => w.ticker)

  const snapshotKey = (market: string, ticker: string) => `${market}:${ticker}`
  const snapMap = new Map<string, { close: number | null; changePct: number | null; tradeDate: string }>()

  if (krTickers.length > 0) {
    const { data } = await supabase
      .from('stock_daily_snapshots')
      .select('ticker, close, change_pct, trade_date')
      .in('ticker', krTickers)
      .eq('market', 'KR')
      .order('trade_date', { ascending: false })
    for (const row of data ?? []) {
      const key = snapshotKey('KR', row.ticker)
      if (!snapMap.has(key)) {
        snapMap.set(key, {
          close: Number(row.close),
          changePct: row.change_pct !== null ? Number(row.change_pct) : null,
          tradeDate: row.trade_date,
        })
      }
    }
  }

  if (usTickers.length > 0) {
    const { data } = await supabase
      .from('stock_daily_snapshots')
      .select('ticker, close, change_pct, trade_date')
      .in('ticker', usTickers)
      .eq('market', 'US')
      .order('trade_date', { ascending: false })
    for (const row of data ?? []) {
      const key = snapshotKey('US', row.ticker)
      if (!snapMap.has(key)) {
        snapMap.set(key, {
          close: Number(row.close),
          changePct: row.change_pct !== null ? Number(row.change_pct) : null,
          tradeDate: row.trade_date,
        })
      }
    }
  }

  // 2. 데이터 없거나 오래된 종목 → 네이버 API 실시간 조회 (병렬)
  const staleItems = stockItems.filter((w) => {
    const snap = snapMap.get(snapshotKey(w.market, w.ticker))
    return !snap || !isFresh(snap.tradeDate)
  })

  if (staleItems.length > 0) {
    const liveResults = await Promise.all(
      staleItems.map(async (w) => ({
        key: snapshotKey(w.market, w.ticker),
        data: await fetchLivePrice(w.ticker, w.market, w.asset_type),
      })),
    )
    for (const { key, data } of liveResults) {
      snapMap.set(key, data)
    }
  }

  // 3. 워치리스트 전체에 price 정보 병합
  const enriched = watchlist.map((w) => {
    const snap = snapMap.get(snapshotKey(w.market, w.ticker))
    return {
      ...w,
      close: snap?.close ?? null,
      changePct: snap?.changePct ?? null,
      tradeDate: snap?.tradeDate ?? '',
    }
  })

  return NextResponse.json({ watchlist: enriched, count: enriched.length })
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
