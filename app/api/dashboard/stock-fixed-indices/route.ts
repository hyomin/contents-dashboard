import { NextResponse } from 'next/server'
import { fetchNaverDailySeries, fetchNaverWorldDailySeries } from '@/lib/data/naver-finance-stock'
import { FIXED_INDEX_LIST } from '@/lib/dashboard/stock-config'

export interface FixedIndexSnapshot {
  ticker: string
  market: 'KR' | 'US'
  name: string
  close: number | null
  changePct: number | null
  tradeDate: string
}

function calcChangePct(close: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null
  return ((close - prev) / prev) * 100
}

export async function GET() {
  const results: FixedIndexSnapshot[] = []

  // KR 지수 — 네이버 금융 API 실시간 조회 (키 불필요)
  const krList = FIXED_INDEX_LIST.filter((i) => i.market === 'KR')
  await Promise.all(
    krList.map(async (idx) => {
      const res = await fetchNaverDailySeries(idx.ticker, idx.assetType, 3)
      if (res.ok && res.bars && res.bars.length >= 1) {
        const sorted = [...res.bars].sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
        const latest = sorted[sorted.length - 1]
        const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
        results.push({
          ticker: idx.ticker,
          market: 'KR',
          name: idx.name,
          close: latest.close,
          changePct: calcChangePct(latest.close, prev?.close ?? null),
          tradeDate: latest.tradeDate,
        })
      } else {
        results.push({ ticker: idx.ticker, market: 'KR', name: idx.name, close: null, changePct: null, tradeDate: '' })
      }
    }),
  )

  // US 지수 — 네이버 해외주식 API 실시간 조회 (KR과 동일 방식, 키 불필요)
  const usList = FIXED_INDEX_LIST.filter((i) => i.market === 'US')
  await Promise.all(
    usList.map(async (idx) => {
      const res = await fetchNaverWorldDailySeries(idx.ticker, 3)
      if (res.ok && res.bars && res.bars.length >= 1) {
        const sorted = [...res.bars].sort((a, b) => (a.tradeDate < b.tradeDate ? -1 : 1))
        const latest = sorted[sorted.length - 1]
        const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
        results.push({
          ticker: idx.ticker,
          market: 'US',
          name: idx.name,
          close: latest.close,
          changePct: calcChangePct(latest.close, prev?.close ?? null),
          tradeDate: latest.tradeDate,
        })
      } else {
        results.push({ ticker: idx.ticker, market: 'US', name: idx.name, close: null, changePct: null, tradeDate: '' })
      }
    }),
  )

  // FIXED_INDEX_LIST 순서 유지
  const ordered = FIXED_INDEX_LIST.map(
    (idx) =>
      results.find((r) => r.ticker === idx.ticker && r.market === idx.market) ?? {
        ticker: idx.ticker,
        market: idx.market as 'KR' | 'US',
        name: idx.name,
        close: null,
        changePct: null,
        tradeDate: '',
      },
  )

  return NextResponse.json({ indices: ordered })
}
