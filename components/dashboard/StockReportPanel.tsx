'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import { Spinner } from '@/components/dashboard/ui/loading'
import { StockSearchPicker, type StockPickItem } from '@/components/dashboard/StockSearchPicker'
import { listStockSectors } from '@/lib/dashboard/stock-sector-directory'
import { KR_MARKET_CLOSE_KST } from '@/lib/dashboard/stock-config'
import type { FixedIndexSnapshot } from '@/app/api/dashboard/stock-fixed-indices/route'
import type { TrendingTickerItem } from '@/app/api/dashboard/stock-trending-tickers/route'

import type { StockDailyItemResult } from '@/lib/dashboard/stock-daily-report'
export type { StockDailyItemResult } from '@/lib/dashboard/stock-daily-report'

interface StockWatchlistItem {
  id: string
  ticker: string
  market: 'KR' | 'US'
  asset_type: 'stock' | 'index'
  name: string
  sort_order: number
  close: number | null
  changePct: number | null
  tradeDate: string
}

interface StockReportSettings {
  id: string
  auto_generate_enabled: boolean
  skip_until: string | null
  updated_at: string
}

interface FocusChartResult {
  market: 'KR' | 'US'
  ticker: string
  name: string
  slideFiles: string[]
}

const STOCK_SECTORS = listStockSectors()

function todayKstDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** KST 기준 다음 자동 리포팅 예정 시각 레이블 */
function getNextAutoReportLabel(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const h = kst.getUTCHours()
  const m = kst.getUTCMinutes()
  const afterClose = h > 15 || (h === 15 && m >= 30)
  if (afterClose) {
    const tomorrow = new Date(kst)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const mm = String(tomorrow.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getUTCDate()).padStart(2, '0')
    return `다음 영업일(${mm}/${dd}) ${KR_MARKET_CLOSE_KST} KST`
  }
  return `오늘 ${KR_MARKET_CLOSE_KST} KST`
}

function pctColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400 dark:text-gray-500'
  if (pct > 0) return 'text-red-500 dark:text-red-400'
  if (pct < 0) return 'text-blue-500 dark:text-blue-400'
  return 'text-gray-400 dark:text-gray-500'
}

function pctLabel(pct: number | null): string {
  if (pct === null) return '-'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
}

async function copySlideAsHtml(path: string, caption: string, addToast: AddToast) {
  try {
    const res = await fetch(`/api/dashboard/stock-output-image?path=${encodeURIComponent(path)}`)
    if (!res.ok) { addToast('이미지를 불러오지 못했습니다', 'warning'); return }
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const html = `<figure style="margin:0 0 16px;text-align:center;">\n  <img src="${dataUrl}" alt="${caption}" style="max-width:100%;height:auto;border-radius:8px;" />\n  <figcaption style="font-size:12px;color:#888;margin-top:6px;">${caption}</figcaption>\n</figure>`
    await navigator.clipboard.writeText(html)
    addToast('블로그용 HTML 코드가 클립보드에 복사되었습니다 ✨', 'success')
  } catch {
    addToast('HTML 변환에 실패했습니다', 'warning')
  }
}

interface StockReportPanelProps {
  addToast: AddToast
  onGenerated: (script: ScriptGuideOutput, polished: ContentPolishResult, historyId: string | null) => void
  onDailyResults?: (items: StockDailyItemResult[]) => void
  onSaved?: () => void
}

export function StockReportPanel({ addToast, onGenerated, onDailyResults, onSaved }: StockReportPanelProps) {
  // 지수 지표
  const [fixedIndices, setFixedIndices] = useState<FixedIndexSnapshot[]>([])
  const [indicesLoading, setIndicesLoading] = useState(true)

  // 개별 지표 (RSS 트렌딩)
  const [trending, setTrending] = useState<TrendingTickerItem[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [rssCollecting, setRssCollecting] = useState(false)

  // 자동 리포팅 설정
  const [settings, setSettings] = useState<StockReportSettings | null>(null)

  // 워치리스트 관리
  const [watchlistStocks, setWatchlistStocks] = useState<StockWatchlistItem[]>([])
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [addCardOpen, setAddCardOpen] = useState(false)

  // 리포트 생성
  const [generating, setGenerating] = useState(false)
  const [dailyResults, setDailyResults] = useState<StockDailyItemResult[]>([])
  const [activeResultKey, setActiveResultKey] = useState<string | null>(null)
  // 시세 없어 자동 수집 중인 종목 키 집합 (market:ticker)
  const [collectingKeys, setCollectingKeys] = useState<Set<string>>(new Set())
  const collectingRef = useRef<Set<string>>(new Set())

  // 썸네일 미리보기 모달
  const [thumbModal, setThumbModal] = useState<{ name: string; slideFiles: string[]; title?: string } | null>(null)

  // 종목 분석 리포트 (포커스)
  const [focusItems, setFocusItems] = useState<StockPickItem[]>([])
  const [focusNote, setFocusNote] = useState('')
  const [focusGenerating, setFocusGenerating] = useState(false)
  const [focusCharts, setFocusCharts] = useState<FocusChartResult[]>([])
  const [analysisMode, setAnalysisMode] = useState<'company' | 'sector'>('company')
  const [selectedSectorId, setSelectedSectorId] = useState('')

  const loadFixedIndices = useCallback(async () => {
    setIndicesLoading(true)
    try {
      const res = await fetch('/api/dashboard/stock-fixed-indices')
      const data = (await res.json()) as { indices?: FixedIndexSnapshot[] }
      setFixedIndices(data.indices ?? [])
    } catch { /* ignore */ } finally {
      setIndicesLoading(false)
    }
  }, [])

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true)
    try {
      const res = await fetch('/api/dashboard/stock-trending-tickers')
      const data = (await res.json()) as { trending?: TrendingTickerItem[] }
      setTrending(data.trending ?? [])
    } catch { /* ignore */ } finally {
      setTrendingLoading(false)
    }
  }, [])

  const handleRssCollect = async () => {
    setRssCollecting(true)
    try {
      const res = await fetch('/api/dashboard/rss-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAudience: '경제' }),
      })
      if (!res.ok) {
        addToast('RSS 수집에 실패했습니다', 'warning')
        return
      }
      const data = (await res.json()) as { savedCount?: number; message?: string }
      addToast(`RSS 수집 완료 (${data.savedCount ?? 0}건) — 이슈 종목을 갱신합니다`, 'success')
      await loadTrending()
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setRssCollecting(false)
    }
  }

  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stock-watchlist')
      const data = (await res.json()) as { watchlist?: StockWatchlistItem[] }
      setWatchlistStocks((data.watchlist ?? []).filter((w) => w.asset_type === 'stock'))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    void loadFixedIndices()
    void loadTrending()
    void loadWatchlist()
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/stock-report-settings')
        const data = (await res.json()) as StockReportSettings
        setSettings(data)
      } catch { /* ignore */ }
    })()
  }, [loadFixedIndices, loadTrending, loadWatchlist])

  const updateSettings = async (patch: { autoGenerateEnabled?: boolean; skipUntil?: string | null }) => {
    try {
      const res = await fetch('/api/dashboard/stock-report-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as StockReportSettings
      if (res.ok) setSettings(data)
    } catch {
      addToast('설정 변경에 실패했습니다', 'warning')
    }
  }

  const handleAddWatchlist = async (item: StockPickItem) => {
    setWatchlistBusy(true)
    try {
      const res = await fetch('/api/dashboard/stock-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: item.ticker, market: item.market, name: item.name, assetType: 'stock' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        addToast(data.error ?? '종목 추가에 실패했습니다', 'warning')
        return
      }
      await loadWatchlist()
      addToast(`${item.name} 추가됨`, 'success')
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setWatchlistBusy(false)
    }
  }

  const handleRemoveWatchlist = async (id: string) => {
    setWatchlistBusy(true)
    try {
      const res = await fetch(`/api/dashboard/stock-watchlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) { addToast('종목 삭제에 실패했습니다', 'warning'); return }
      await loadWatchlist()
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setWatchlistBusy(false)
    }
  }

  const handleGenerate = async (force = false) => {
    setGenerating(true)
    if (!force) setDailyResults([])
    let keepGenerating = false
    try {
      const res = await fetch('/api/dashboard/stock-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const data = (await res.json()) as {
        reportDate?: string
        items?: StockDailyItemResult[]
        error?: string
        alreadyExists?: boolean
        count?: number
        message?: string
      }

      if (res.status === 409 && data.alreadyExists) {
        const confirmed = window.confirm(
          `${data.message ?? '오늘 이미 일일 리포트가 생성됐습니다.'}\n\n재생성하시겠습니까?`,
        )
        if (confirmed) {
          keepGenerating = true
          void handleGenerate(true)
        }
        return
      }

      if (!res.ok || !data.items) {
        addToast(data.error ?? '주식 일일 리포트 생성에 실패했습니다', 'warning')
        return
      }
      setDailyResults(data.items)
      onDailyResults?.(data.items)
      onSaved?.()
      const okCount = data.items.filter((i) => i.ok).length
      const autoCount = data.items.filter((i) => !i.ok && i.autoCollecting).length
      const skipCount = data.items.filter((i) => !i.ok && !i.autoCollecting).length
      const warnCount = data.items.filter((i) => i.ok && i.warning).length
      addToast(
        `리포트 ${okCount}건 생성 완료${autoCount > 0 ? ` (${autoCount}건 자동 수집 진행 중)` : ''}${skipCount > 0 ? ` (${skipCount}건 skip)` : ''} ✨`,
        okCount > 0 || autoCount > 0 ? 'success' : 'warning',
      )
      if (warnCount > 0) addToast(`${warnCount}건의 리포트에 데이터 신선도 경고가 있습니다`, 'warning')

      // 첫 번째 성공 리포트를 자동 선택해 하단 결과 영역에 표시
      const firstOk = data.items.find((i) => i.ok && i.script && i.polished)
      if (firstOk) {
        setActiveResultKey(`${firstOk.market}:${firstOk.ticker}`)
        onGenerated(firstOk.script!, firstOk.polished!, firstOk.historyId ?? null)
      }

      // 시세 없는 종목: 자동으로 수집 + 생성 트리거
      const autoItems = data.items.filter((i) => !i.ok && i.autoCollecting)
      if (autoItems.length > 0) {
        const reportDate = data.reportDate ?? new Date().toISOString().slice(0, 10)
        for (const autoItem of autoItems) {
          void triggerSingleReport(autoItem, reportDate, (updated) => {
            setDailyResults((prev) => {
              const next = prev.map((r) =>
                r.ticker === updated.ticker && r.market === updated.market ? { ...updated, autoCollecting: false } : r,
              )
              onDailyResults?.(next)
              if (updated.ok) onSaved?.()
              // 성공 시 첫 결과로 자동 선택
              if (updated.ok && updated.script && updated.polished) {
                setActiveResultKey(`${updated.market}:${updated.ticker}`)
                onGenerated(updated.script, updated.polished, updated.historyId ?? null)
              }
              return next
            })
          })
        }
      }
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      if (!keepGenerating) setGenerating(false)
    }
  }

  const triggerSingleReport = useCallback(async (
    item: StockDailyItemResult,
    reportDate: string,
    onResult: (updated: StockDailyItemResult) => void,
  ) => {
    const key = `${item.market}:${item.ticker}`
    collectingRef.current.add(key)
    setCollectingKeys(new Set(collectingRef.current))

    try {
      const res = await fetch('/api/dashboard/stock-report-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: item.ticker,
          market: item.market,
          assetType: 'stock',
          name: item.name,
          reportDate,
        }),
      })
      const data = (await res.json()) as StockDailyItemResult
      onResult(data)
      if (data.ok) {
        addToast(`${item.name} 시세 수집 + 리포트 생성 완료 ✨`, 'success')
      } else {
        addToast(`${item.name} 수집 실패: ${data.error ?? '알 수 없는 오류'}`, 'warning')
      }
    } catch {
      onResult({ ...item, ok: false, autoCollecting: false, error: '네트워크 오류' })
      addToast(`${item.name} 시세 수집 중 오류가 발생했습니다`, 'warning')
    } finally {
      collectingRef.current.delete(key)
      setCollectingKeys(new Set(collectingRef.current))
    }
  }, [addToast])

  const handleOpenDailyItem = (item: StockDailyItemResult) => {
    if (!item.script || !item.polished) return
    setActiveResultKey(`${item.market}:${item.ticker}`)
    onGenerated(item.script, item.polished, item.historyId ?? null)
  }

  const handleAddFocusItem = (item: StockPickItem) => {
    setFocusItems((prev) => {
      if (prev.some((p) => p.market === item.market && p.ticker === item.ticker)) return prev
      if (prev.length >= 3) { addToast('관심 종목은 최대 3개까지 선택할 수 있습니다', 'warning'); return prev }
      return [...prev, item]
    })
  }

  const handleRemoveFocusItem = (index: number) => {
    setFocusItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGenerateFocus = async () => {
    let body: { items: StockPickItem[]; note: string } | { sectorId: string }
    if (analysisMode === 'sector') {
      if (!selectedSectorId) { addToast('분석할 섹터를 선택해주세요', 'warning'); return }
      body = { sectorId: selectedSectorId }
    } else {
      if (focusItems.length === 0) { addToast('분석할 종목을 1개 이상 선택해주세요', 'warning'); return }
      body = { items: focusItems, note: focusNote }
    }

    setFocusGenerating(true)
    setFocusCharts([])
    try {
      const res = await fetch('/api/dashboard/stock-report-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        script?: ScriptGuideOutput
        polished?: ContentPolishResult
        item?: { id: string }
        charts?: FocusChartResult[]
        error?: string
        alphaVantageRequired?: boolean
      }
      if (!res.ok || !data.script || !data.polished) {
        if (data.alphaVantageRequired) {
          addToast('US 종목 분석에는 ALPHA_VANTAGE_API_KEY가 필요합니다. KR 종목만 선택하거나 키를 설정해주세요.', 'warning')
        } else {
          addToast(data.error ?? '분석 리포트 생성에 실패했습니다', 'warning')
        }
        return
      }
      onGenerated(data.script, data.polished, data.item?.id ?? null)
      onSaved?.()
      setFocusCharts(data.charts ?? [])
      const chartCount = (data.charts ?? []).reduce((sum, c) => sum + c.slideFiles.length, 0)
      addToast(
        chartCount > 0 ? `분석 리포트와 차트 이미지 ${chartCount}장을 생성·저장했습니다 ✨` : '분석 리포트를 생성·저장했습니다 ✨',
        'success',
      )
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setFocusGenerating(false)
    }
  }

  const isSkippedToday = !!settings?.skip_until && settings.skip_until >= todayKstDate()
  const krIndices = fixedIndices.filter((i) => i.market === 'KR')
  const usIndices = fixedIndices.filter((i) => i.market === 'US')
  const krStocks = watchlistStocks.filter((w) => w.market === 'KR')
  const usStocks = watchlistStocks.filter((w) => w.market === 'US')

  return (
    <div className="space-y-4">

      {/* ══════════════════════════════════════════════════
          1. [지수 지표] — 고정 주요 지수 실시간 현황
      ══════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">📊 지수 지표</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">주요 시장 지수 현황</span>
          </div>
          <button
            type="button"
            onClick={() => void loadFixedIndices()}
            disabled={indicesLoading}
            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40 transition"
          >
            {indicesLoading ? <Spinner size="sm" /> : '↻ 새로고침'}
          </button>
        </div>

        {indicesLoading ? (
          <div className="flex justify-center py-3"><Spinner size="sm" /></div>
        ) : (
          <div className="space-y-2">
            {/* KR 지수 */}
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">KR (네이버 금융 실시간)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {krIndices.map((idx) => (
                  <IndexCard key={`${idx.market}:${idx.ticker}`} idx={idx} />
                ))}
              </div>
            </div>

            {/* US 지수 */}
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                US (ETF 대리 지수 — 네이버 금융 실시간)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {usIndices.map((idx) => (
                  <IndexCard key={`${idx.market}:${idx.ticker}`} idx={idx} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════
          2. 주식 일일 리포트 — 자동 리포팅 설정 + 생성
      ══════════════════════════════════════════════════ */}
      <section className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 p-5 space-y-4 shadow-sm">

        {/* 헤더 + 자동 리포팅 토글 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">📈 주식 일일 리포트</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-emerald-800 dark:text-emerald-200">
              <input
                type="checkbox"
                checked={settings?.auto_generate_enabled ?? true}
                onChange={(e) => void updateSettings({ autoGenerateEnabled: e.target.checked })}
                className="rounded border-emerald-300"
              />
              장 마감 자동 리포팅 ({KR_MARKET_CLOSE_KST} KST)
            </label>
            <button
              type="button"
              onClick={() => void updateSettings({ skipUntil: isSkippedToday ? null : todayKstDate() })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                isSkippedToday
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/30'
              }`}
            >
              {isSkippedToday ? '오늘 건너뜀 ✓' : '오늘만 건너뛰기'}
            </button>
          </div>
        </div>

        {/* 다음 자동 생성 예정 */}
        {(settings?.auto_generate_enabled ?? true) && !isSkippedToday && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 -mt-2">
            다음 자동 생성 예정: <span className="font-semibold">{getNextAutoReportLabel()}</span>
            <span className="ml-1 text-emerald-500 dark:text-emerald-600">· n8n 스케줄 연동</span>
          </p>
        )}
        {isSkippedToday && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 -mt-2">
            오늘({todayKstDate()}) 자동 생성이 건너뛰어집니다.
          </p>
        )}

        {/* 내 워치리스트 — 직접 표시 (KR / US 분리) */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 p-3 space-y-3 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              내 워치리스트
              <span className="ml-1.5 text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                ({watchlistStocks.length}개 종목 · 일일 리포트 생성 대상)
              </span>
            </span>
            {watchlistBusy && <Spinner size="sm" />}
          </div>

          {watchlistStocks.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-1">종목이 없습니다. 아래에서 추가하세요.</p>
          ) : (
            <div className="space-y-3">
              {/* KR 종목 */}
              {krStocks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">KR</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {krStocks.map((w) => (
                      <WatchlistCard key={w.id} item={w} onRemove={handleRemoveWatchlist} busy={watchlistBusy} />
                    ))}
                  </div>
                </div>
              )}
              {/* US 종목 */}
              {usStocks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">US</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {usStocks.map((w) => (
                      <WatchlistCard key={w.id} item={w} onRemove={handleRemoveWatchlist} busy={watchlistBusy} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setAddCardOpen((v) => !v)}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {addCardOpen ? '– 닫기' : '+ 종목 추가'}
            </button>
          </div>
          {addCardOpen && (
            <StockSearchPicker
              onPick={(item) => {
                void handleAddWatchlist(item)
                setAddCardOpen(false)
              }}
            />
          )}
        </div>

        {/* 오늘 리포트 생성 버튼 */}
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" color="border-white" />
              워치리스트 {watchlistStocks.length || ''}건 리포트 생성 중…
            </span>
          ) : (
            `✨ 오늘 리포트 생성 (워치리스트 ${watchlistStocks.length}개 종목)`
          )}
        </button>

        {/* 생성 결과 요약 — 클릭하면 하단 결과 영역에 표시 */}
        {dailyResults.length > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-100">
                📋 리포트 생성 결과 ({dailyResults.filter((r) => r.ok).length}건 성공 / {dailyResults.filter((r) => !r.ok).length}건 skip)
              </p>
              <p className="text-[9px] text-emerald-600 dark:text-emerald-400">클릭 → 하단에서 보기</p>
            </div>
            <ul className="space-y-1">
              {dailyResults.map((r) => {
                const key = `${r.market}:${r.ticker}`
                const isActive = activeResultKey === key
                const isCollecting = collectingKeys.has(key)
                return (
                  <li key={key}>
                    {isCollecting ? (
                      /* 자동 수집 중 인디케이터 */
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-2 flex items-center gap-2">
                        <Spinner size="sm" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 truncate">{r.name}</p>
                          <p className="text-[9px] text-blue-500 dark:text-blue-400">시세 수집 후 리포트 생성 중…</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg border px-2.5 py-1.5 space-y-1 transition ${
                          r.ok
                            ? isActive
                              ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 cursor-pointer'
                              : 'border-emerald-100 dark:border-emerald-900 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer'
                            : 'border-gray-100 dark:border-gray-800 opacity-60'
                        }`}
                        onClick={() => r.ok && handleOpenDailyItem(r)}
                        role={r.ok ? 'button' : undefined}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span className={`shrink-0 text-[10px] ${r.ok ? 'text-emerald-500' : 'text-gray-400'}`}>
                              {r.ok ? '✅' : '⏭'}
                            </span>
                            <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {r.ok ? r.title ?? r.name : `${r.name} — skip`}
                            </p>
                            {isActive && (
                              <span className="shrink-0 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 rounded px-1">
                                보는 중
                              </span>
                            )}
                          </div>
                          {r.ok && (
                            <div className="shrink-0 flex items-center gap-1">
                              {r.historyId && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); window.open(`/api/dashboard/content-output-html?historyId=${encodeURIComponent(r.historyId!)}`, '_blank') }}
                                  className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition"
                                >
                                  🖼️ HTML
                                </button>
                              )}
                              {r.slideFiles && r.slideFiles.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setThumbModal({ name: r.name, slideFiles: r.slideFiles!, title: r.title ?? r.name }) }}
                                  className="px-2.5 py-1 rounded text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 transition shadow-sm"
                                >
                                  📷 썸네일
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {r.ok ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] text-gray-400 font-mono">
                              slide {r.slideFiles?.length ?? 0}
                              {r.dataDate ? ` · ${r.dataDate}` : ''}
                            </span>
                            {r.warning && <span className="text-[9px] text-amber-600 dark:text-amber-400">{r.warning}</span>}
                            {r.slideFiles && r.slideFiles.length > 0 && (
                              <>
                                <span className="text-[9px] text-gray-300 dark:text-gray-600">|</span>
                                <span className="text-[9px] text-gray-400">슬라이드:</span>
                                {r.slideFiles.map((f, i) => (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); void copySlideAsHtml(f, `${r.name} 차트 ${i + 1}`, addToast) }}
                                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition"
                                  >
                                    {i + 1}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-[9px] text-gray-400 dark:text-gray-500">{r.error}</p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════
          3. 종목 분석 리포트 (포커스 / 섹터 — 기존 유지)
      ══════════════════════════════════════════════════ */}
      <section className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-gray-900 p-5 space-y-3 shadow-sm">
        <h3 className="text-base font-bold text-indigo-900 dark:text-indigo-100">🔍 종목 분석 리포트</h3>

        <div className="flex gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setAnalysisMode('company')}
            className={`flex-1 px-3 py-1.5 rounded-lg font-semibold transition ${
              analysisMode === 'company'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200'
            }`}
          >
            기업 검색
          </button>
          <button
            type="button"
            onClick={() => setAnalysisMode('sector')}
            className={`flex-1 px-3 py-1.5 rounded-lg font-semibold transition ${
              analysisMode === 'sector'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200'
            }`}
          >
            섹터 분석
          </button>
        </div>

        {analysisMode === 'company' ? (
          <>
            <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed">
              워치리스트와 무관하게, 지금 궁금한 종목(최근 이슈가 있는 국내·미국 기업)을 1~3개 선택하면 최근 시세
              데이터를 바탕으로 분석 리포트를 생성합니다. 참고 메모를 적으면 본문에 반영됩니다.
            </p>
            <StockSearchPicker onPick={handleAddFocusItem} />
            {focusItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {focusItems.map((item, idx) => (
                  <span
                    key={`${item.market}:${item.ticker}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 text-[11px] text-gray-700 dark:text-gray-200"
                  >
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{item.market}</span>
                    {item.name}
                    <button type="button" onClick={() => handleRemoveFocusItem(idx)} aria-label={`${item.name} 제거`} className="text-gray-400 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value)}
              placeholder="참고 메모 (선택) — 최근 이슈·뉴스를 적어주면 리포트에 반영됩니다"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 text-xs resize-none"
            />
          </>
        ) : (
          <>
            <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed">
              개별 기업명 대신 섹터/카테고리를 선택하면 해당 섹터의 구성종목 시세를 종합해 산업 분석 리포트를 생성합니다.
            </p>
            <select
              value={selectedSectorId}
              onChange={(e) => setSelectedSectorId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 text-xs"
            >
              <option value="">섹터를 선택하세요</option>
              {STOCK_SECTORS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          onClick={() => void handleGenerateFocus()}
          disabled={focusGenerating || (analysisMode === 'company' ? focusItems.length === 0 : !selectedSectorId)}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {focusGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" color="border-white" />
              분석 리포트 생성 중…
            </span>
          ) : (
            '🔍 분석 리포트 생성'
          )}
        </button>

        {focusCharts.length > 0 && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-100">📊 차트/슬라이드 이미지 생성 완료</p>
            {focusCharts.map((c) => (
              <div key={`${c.market}:${c.ticker}`} className="text-[11px] text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">{c.name}</span>
                <span className="ml-1 text-gray-400">(슬라이드 {c.slideFiles.length}장)</span>
                <ul className="mt-0.5 ml-3 list-disc text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                  {c.slideFiles.map((f) => <li key={f}>{f}</li>)}
                </ul>
                {c.slideFiles.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[9px] text-gray-400">슬라이드 HTML 변환:</span>
                    {c.slideFiles.map((f, i) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => void copySlideAsHtml(f, `${c.name} 차트 ${i + 1}`, addToast)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════
          4. [개별 지표] — RSS 이슈 종목 (보조, 최하단)
      ══════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">개별 지표</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500">RSS 24h 이슈 종목 · 참고용</span>
          </div>
          <button
            type="button"
            onClick={() => void loadTrending()}
            disabled={trendingLoading}
            className="text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40 transition"
          >
            {trendingLoading ? <Spinner size="sm" /> : '↻'}
          </button>
        </div>

        {trendingLoading ? (
          <div className="flex justify-center py-2"><Spinner size="sm" /></div>
        ) : trending.length === 0 ? (
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">RSS 멘션 데이터 없음</p>
            <button
              type="button"
              onClick={() => void handleRssCollect()}
              disabled={rssCollecting}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {rssCollecting ? <><Spinner size="sm" /> 수집 중…</> : '📡 RSS 수집'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {trending.map((t) => (
              <div
                key={t.ticker}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 text-[10px] text-gray-600 dark:text-gray-300"
              >
                <span className="font-semibold text-gray-800 dark:text-gray-100">{t.name}</span>
                <span className={`font-semibold ${pctColor(t.changePct)}`}>{pctLabel(t.changePct)}</span>
                <span className="text-slate-400 dark:text-slate-500">{t.mentionCount}건</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════
          썸네일 미리보기 모달
      ══════════════════════════════════════════════════ */}
      {thumbModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setThumbModal(null)}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-0.5">썸네일 미리보기</p>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{thumbModal.name}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  플랫폼별로 첫 번째 이미지가 자동 썸네일로 사용됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setThumbModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-3 mt-0.5"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                모바일 목록 카드 미리보기
              </p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm max-w-sm mx-auto">
                <img
                  src={`/api/dashboard/stock-output-image?path=${encodeURIComponent(thumbModal.slideFiles[0])}`}
                  alt={`${thumbModal.name} 썸네일`}
                  className="w-full object-cover"
                  style={{ aspectRatio: '16/9' }}
                />
                <div className="p-3 bg-white dark:bg-gray-800">
                  <p className="text-xs font-bold text-gray-900 dark:text-white leading-snug">
                    {thumbModal.title ?? thumbModal.name} 주가 분석 리포트
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">marketlog · 방금 전</p>
                </div>
              </div>

              {thumbModal.slideFiles.length > 1 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    전체 차트 슬라이드 ({thumbModal.slideFiles.length}장)
                    <span className="font-normal ml-1 text-gray-400">— 클릭하면 원본 크기로 열립니다</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {thumbModal.slideFiles.map((f, i) => (
                      <div key={f} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-zoom-in"
                        onClick={() => window.open(`/api/dashboard/stock-output-image?path=${encodeURIComponent(f)}`, '_blank')}
                      >
                        <img
                          src={`/api/dashboard/stock-output-image?path=${encodeURIComponent(f)}`}
                          alt={`슬라이드 ${i + 1}`}
                          className="w-full object-cover"
                          style={{ aspectRatio: '16/9' }}
                        />
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold rounded px-1.5 py-0.5">
                          {i === 0 ? '썸네일 ★' : `차트 ${i + 1}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  <span className="font-bold">⚠️ 현재 제약:</span> 이미지 URL이 로컬 전용이라 실제 발행 시 이미지가 깨집니다.
                  Supabase Storage 연동을 적용하면 외부 플랫폼에서도 썸네일이 정상 표시됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 워치리스트 종목 카드 ────────────────────────────────────────────

function WatchlistCard({
  item,
  onRemove,
  busy,
}: {
  item: StockWatchlistItem
  onRemove: (id: string) => Promise<void>
  busy: boolean
}) {
  return (
    <div className="relative rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-2 space-y-0.5 group">
      <button
        type="button"
        onClick={() => void onRemove(item.id)}
        disabled={busy}
        aria-label={`${item.name} 제거`}
        className="absolute top-1 right-1 text-gray-300 dark:text-gray-600 hover:text-red-500 disabled:opacity-50 text-xs leading-none opacity-0 group-hover:opacity-100 transition"
      >
        ×
      </button>
      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate pr-3 leading-tight">{item.name}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
        {item.close !== null ? item.close.toLocaleString() : '-'}
      </p>
      <p className={`text-[11px] font-semibold ${pctColor(item.changePct)}`}>
        {pctLabel(item.changePct)}
      </p>
      {item.tradeDate && (
        <p className="text-[9px] text-gray-400 dark:text-gray-500">{item.tradeDate}</p>
      )}
    </div>
  )
}

// ── 지수 카드 서브컴포넌트 ────────────────────────────────────────────

function IndexCard({ idx }: { idx: FixedIndexSnapshot }) {
  const color = pctColor(idx.changePct)
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 space-y-0.5">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 truncate">{idx.name}</p>
        {idx.market === 'US' && (
          <span className="shrink-0 text-[8px] font-bold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded px-1">US</span>
        )}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-white">
        {idx.close !== null ? idx.close.toLocaleString() : '-'}
      </p>
      <p className={`text-[11px] font-semibold ${color}`}>
        {pctLabel(idx.changePct)}
      </p>
      {idx.tradeDate && (
        <p className="text-[9px] text-gray-400 dark:text-gray-500">{idx.tradeDate}</p>
      )}
    </div>
  )
}
