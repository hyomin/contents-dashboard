import { NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase'
import { KR_STOCK_DIRECTORY } from '@/lib/dashboard/kr-stock-directory'

const MAX_TRENDING = 10
const LOOKBACK_HOURS = 24

export interface TrendingTickerItem {
  ticker: string
  market: 'KR'
  name: string
  mentionCount: number
  close: number | null
  changePct: number | null
  tradeDate: string
}

export async function GET() {
  // 최근 24시간 RSS 토픽 (경제·뉴스 카테고리 우선, 최대 300건)
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString()

  const { data: topics } = await supabase
    .from('rss_topic_candidates')
    .select('title, ai_title, source_feed')
    .gte('collected_at', since)
    .order('collected_at', { ascending: false })
    .limit(300)

  const texts = (topics ?? []).map((t) => `${t.ai_title ?? ''}${t.title ?? ''}`)

  // 종목명 멘션 카운트 (KR 종목 디렉토리 전체 대상)
  const mentionMap = new Map<string, number>()
  for (const entry of KR_STOCK_DIRECTORY) {
    let count = 0
    for (const text of texts) {
      if (text.includes(entry.name)) count++
    }
    if (count > 0) mentionMap.set(entry.ticker, count)
  }

  const sorted = [...mentionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TRENDING)

  if (sorted.length === 0) {
    return NextResponse.json({ trending: [] as TrendingTickerItem[] })
  }

  // 스냅샷 가격 조회 (stock_daily_snapshots — W11 수집분)
  const tickers = sorted.map(([t]) => t)
  const { data: snaps } = await supabase
    .from('stock_daily_snapshots')
    .select('ticker, trade_date, close, change_pct')
    .in('ticker', tickers)
    .eq('market', 'KR')
    .order('trade_date', { ascending: false })

  const snapByTicker = new Map<string, { close: number; change_pct: number | null; trade_date: string }>()
  for (const row of snaps ?? []) {
    if (!snapByTicker.has(row.ticker)) {
      snapByTicker.set(row.ticker, {
        close: Number(row.close),
        change_pct: row.change_pct !== null ? Number(row.change_pct) : null,
        trade_date: row.trade_date,
      })
    }
  }

  const trending: TrendingTickerItem[] = sorted.map(([ticker, mentionCount]) => {
    const entry = KR_STOCK_DIRECTORY.find((e) => e.ticker === ticker)!
    const snap = snapByTicker.get(ticker)
    return {
      ticker,
      market: 'KR',
      name: entry.name,
      mentionCount,
      close: snap?.close ?? null,
      changePct: snap?.change_pct ?? null,
      tradeDate: snap?.trade_date ?? '',
    }
  })

  return NextResponse.json({ trending })
}
