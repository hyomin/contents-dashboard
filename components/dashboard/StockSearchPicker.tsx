'use client'

import { useEffect, useState } from 'react'

export interface StockPickItem {
  market: 'KR' | 'US'
  ticker: string
  name: string
}

interface StockSearchPickerProps {
  onPick: (item: StockPickItem) => void
}

/** 국내/미국 종목 검색 + 선택 위젯 — 관심 종목 설정·종목 분석 리포트에서 공용으로 사용 */
export function StockSearchPicker({ onPick }: StockSearchPickerProps) {
  const [market, setMarket] = useState<'KR' | 'US'>('KR')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ ticker: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTicker, setManualTicker] = useState('')
  const [manualName, setManualName] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/dashboard/stock-search?market=${market}&q=${encodeURIComponent(q)}`)
          const data = (await res.json()) as { results?: { ticker: string; name: string }[] }
          setResults(data.results ?? [])
        } catch {
          setResults([])
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(timer)
  }, [market, query])

  const handlePick = (item: { ticker: string; name: string }) => {
    onPick({ market, ticker: item.ticker, name: item.name })
    setQuery('')
    setResults([])
  }

  const handleManualAdd = () => {
    const ticker = manualTicker.trim()
    const name = manualName.trim()
    if (!ticker || !name) return
    onPick({ market, ticker, name })
    setManualTicker('')
    setManualName('')
    setManualOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => setMarket('KR')}
            className={`px-2.5 py-1.5 font-semibold transition ${
              market === 'KR'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
          >
            국내
          </button>
          <button
            type="button"
            onClick={() => setMarket('US')}
            className={`px-2.5 py-1.5 font-semibold transition ${
              market === 'US'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
          >
            미국
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={market === 'KR' ? '종목명 검색 (예: 삼성전자)' : 'Company name (e.g. Tesla)'}
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
        />
      </div>

      {loading && <p className="text-[11px] text-gray-400 px-1">검색 중…</p>}

      {!loading && results.length > 0 && (
        <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {results.map((r) => (
            <li key={r.ticker}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-between gap-2"
              >
                <span className="font-semibold text-gray-800 dark:text-gray-100">{r.name}</span>
                <span className="text-gray-400">{r.ticker}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline"
        >
          {manualOpen ? '코드 직접 입력 닫기' : '코드로 직접 입력'}
        </button>
        {manualOpen && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              value={manualTicker}
              onChange={(e) => setManualTicker(e.target.value)}
              placeholder={market === 'KR' ? '종목코드 (예: 005930)' : '심볼 (예: TSLA)'}
              className="w-28 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
            />
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="종목명"
              className="flex-1 min-w-[100px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
            />
            <button
              type="button"
              onClick={handleManualAdd}
              disabled={!manualTicker.trim() || !manualName.trim()}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              추가
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
