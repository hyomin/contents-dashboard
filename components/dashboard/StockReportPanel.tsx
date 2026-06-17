'use client'

import { useEffect, useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import { Spinner } from '@/components/dashboard/ui/loading'
import { StockSearchPicker, type StockPickItem } from '@/components/dashboard/StockSearchPicker'
import { listStockSectors } from '@/lib/dashboard/stock-sector-directory'

interface StockSnapshot {
  ticker: string
  market: 'KR' | 'US'
  name: string
  assetType: 'stock' | 'index'
  tradeDate: string
  close: number | null
  changePct: number | null
}

interface StockWatchlistItem {
  id: string
  ticker: string
  market: 'KR' | 'US'
  asset_type: 'stock' | 'index'
  name: string
  sort_order: number
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
  chartFiles: string[]
  slideFiles: string[]
}

const STOCK_SECTORS = listStockSectors()

interface StockDailyItemResult {
  ticker: string
  market: 'KR' | 'US'
  name: string
  ok: boolean
  historyId?: string
  title?: string
  script?: ScriptGuideOutput
  polished?: ContentPolishResult
  chartFiles?: string[]
  slideFiles?: string[]
  error?: string
}

function todayKstDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** 슬라이드 PNG를 base64 data URI로 변환해 블로그 삽입용 <img> HTML을 클립보드에 복사 */
async function copySlideAsHtml(path: string, caption: string, addToast: AddToast) {
  try {
    const res = await fetch(`/api/dashboard/stock-output-image?path=${encodeURIComponent(path)}`)
    if (!res.ok) {
      addToast('이미지를 불러오지 못했습니다', 'warning')
      return
    }
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
  onSaved?: () => void
}

/** «내 콘텐츠 생성» writing 카테고리 — 주식 일일 리포트 모드: 워치리스트 요약 + 관심 종목 설정 + 종목 분석 리포트 + 자동생성 컨트롤 */
export function StockReportPanel({ addToast, onGenerated, onSaved }: StockReportPanelProps) {
  const [snapshots, setSnapshots] = useState<StockSnapshot[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(true)
  const [settings, setSettings] = useState<StockReportSettings | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dailyResults, setDailyResults] = useState<StockDailyItemResult[]>([])

  const [watchlistStocks, setWatchlistStocks] = useState<StockWatchlistItem[]>([])
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [addCardOpen, setAddCardOpen] = useState(false)

  const [focusItems, setFocusItems] = useState<StockPickItem[]>([])
  const [focusNote, setFocusNote] = useState('')
  const [focusGenerating, setFocusGenerating] = useState(false)
  const [focusCharts, setFocusCharts] = useState<FocusChartResult[]>([])

  const [analysisMode, setAnalysisMode] = useState<'company' | 'sector'>('company')
  const [selectedSectorId, setSelectedSectorId] = useState('')

  const loadSnapshots = async () => {
    try {
      const res = await fetch('/api/dashboard/stock-collect')
      const data = (await res.json()) as { snapshots?: StockSnapshot[] }
      setSnapshots(data.snapshots ?? [])
    } catch {
      /* ignore */
    } finally {
      setSnapshotsLoading(false)
    }
  }

  const loadWatchlist = async () => {
    try {
      const res = await fetch('/api/dashboard/stock-watchlist')
      const data = (await res.json()) as { watchlist?: StockWatchlistItem[] }
      setWatchlistStocks((data.watchlist ?? []).filter((w) => w.asset_type === 'stock'))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadSnapshots()
    void loadWatchlist()
    void (async () => {
      try {
        const res = await fetch('/api/dashboard/stock-report-settings')
        const data = (await res.json()) as StockReportSettings
        setSettings(data)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setDailyResults([])
    try {
      const res = await fetch('/api/dashboard/stock-report', { method: 'POST' })
      const data = (await res.json()) as {
        reportDate?: string
        items?: StockDailyItemResult[]
        error?: string
      }
      if (!res.ok || !data.items) {
        addToast(data.error ?? '주식 일일 리포트 생성에 실패했습니다', 'warning')
        return
      }
      setDailyResults(data.items)
      onSaved?.()
      const okCount = data.items.filter((i) => i.ok).length
      addToast(`종목/지수별 일일 리포트 ${okCount}/${data.items.length}건 생성 완료 ✨`, okCount > 0 ? 'success' : 'warning')
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setGenerating(false)
    }
  }

  const handleOpenDailyItem = (item: StockDailyItemResult) => {
    if (!item.script || !item.polished) return
    onGenerated(item.script, item.polished, item.historyId ?? null)
  }

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
      await Promise.all([loadWatchlist(), loadSnapshots()])
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
      if (!res.ok) {
        addToast('종목 삭제에 실패했습니다', 'warning')
        return
      }
      await Promise.all([loadWatchlist(), loadSnapshots()])
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setWatchlistBusy(false)
    }
  }

  const handleRemoveSnapshotCard = async (snapshot: StockSnapshot) => {
    const match = watchlistStocks.find((w) => w.ticker === snapshot.ticker && w.market === snapshot.market)
    if (!match) {
      addToast('워치리스트 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.', 'warning')
      return
    }
    await handleRemoveWatchlist(match.id)
  }

  const handleAddFocusItem = (item: StockPickItem) => {
    setFocusItems((prev) => {
      if (prev.some((p) => p.market === item.market && p.ticker === item.ticker)) return prev
      if (prev.length >= 3) {
        addToast('관심 종목은 최대 3개까지 선택할 수 있습니다', 'warning')
        return prev
      }
      return [...prev, item]
    })
  }

  const handleRemoveFocusItem = (index: number) => {
    setFocusItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGenerateFocus = async () => {
    let body: { items: StockPickItem[]; note: string } | { sectorId: string }
    if (analysisMode === 'sector') {
      if (!selectedSectorId) {
        addToast('분석할 섹터를 선택해주세요', 'warning')
        return
      }
      body = { sectorId: selectedSectorId }
    } else {
      if (focusItems.length === 0) {
        addToast('분석할 종목을 1개 이상 선택해주세요', 'warning')
        return
      }
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
      }
      if (!res.ok || !data.script || !data.polished) {
        addToast(data.error ?? '분석 리포트 생성에 실패했습니다', 'warning')
        return
      }
      onGenerated(data.script, data.polished, data.item?.id ?? null)
      onSaved?.()
      setFocusCharts(data.charts ?? [])
      const chartCount = (data.charts ?? []).reduce((sum, c) => sum + c.chartFiles.length + c.slideFiles.length, 0)
      addToast(
        chartCount > 0
          ? `분석 리포트와 차트 이미지 ${chartCount}장을 생성·저장했습니다 ✨`
          : '분석 리포트를 생성·저장했습니다 ✨',
        'success',
      )
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setFocusGenerating(false)
    }
  }

  const isSkippedToday = !!settings?.skip_until && settings.skip_until >= todayKstDate()

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">📈 주식 일일 리포트</h3>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-emerald-800 dark:text-emerald-200">
              <input
                type="checkbox"
                checked={settings?.auto_generate_enabled ?? true}
                onChange={(e) => void updateSettings({ autoGenerateEnabled: e.target.checked })}
                className="rounded border-emerald-300"
              />
              자동 생성(n8n) 사용
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
              {isSkippedToday ? '오늘 자동생성 건너뜀 ✓' : '오늘만 건너뛰기'}
            </button>
          </div>
        </div>

        <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">
          워치리스트 종목·지수의 최신 시세를 바탕으로 시황 요약·종목별 패턴분석·고정 디스클레이머를 포함한 일일 리포트를 생성합니다.
          n8n 스케줄로 자동 생성되며, 위 토글로 자동 생성을 끄거나 오늘만 건너뛸 수 있습니다.
          지수를 제외한 종목 카드 우측 상단의 ×로 제거하거나, &quot;종목 추가&quot; 카드에서 검색·코드 입력으로 새 종목을 등록할 수 있습니다.
        </p>

        {snapshotsLoading ? (
          <div className="py-6 flex justify-center"><Spinner size="sm" /></div>
        ) : (
          <>
            {snapshots.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">
                워치리스트 시세 데이터가 없습니다. n8n 시세 수집(W11)이 실행되면 여기에 표시됩니다.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {snapshots.map((s) => {
                const pct = s.changePct
                const color =
                  pct === null ? 'text-gray-500 dark:text-gray-400'
                  : pct > 0 ? 'text-red-600 dark:text-red-400'
                  : pct < 0 ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
                return (
                  <div
                    key={`${s.market}:${s.ticker}`}
                    className="relative rounded-xl bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900 px-3 py-2"
                  >
                    {s.assetType === 'stock' && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveSnapshotCard(s)}
                        disabled={watchlistBusy}
                        aria-label={`${s.name} 제거`}
                        className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[10px] leading-none text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        ×
                      </button>
                    )}
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate pr-3">{s.name}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {s.close !== null ? s.close.toLocaleString() : '-'}
                    </p>
                    <p className={`text-[11px] font-semibold ${color}`}>
                      {pct !== null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '데이터 없음'}
                    </p>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => setAddCardOpen((v) => !v)}
                className="rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 px-3 py-2 flex flex-col items-center justify-center gap-1 min-h-[64px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
              >
                <span className="text-lg leading-none">{addCardOpen ? '×' : '+'}</span>
                <span className="text-[10px] font-semibold">종목 추가</span>
              </button>
            </div>
          </>
        )}

        {addCardOpen && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-100">종목 검색 후 추가 (지수 제외)</p>
              {watchlistBusy && <Spinner size="sm" />}
            </div>
            <StockSearchPicker
              onPick={(item) => {
                void handleAddWatchlist(item)
                setAddCardOpen(false)
              }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" color="border-white" />
              워치리스트 {snapshots.length || ''}건 생성 중…
            </span>
          ) : (
            '✨ 오늘 리포트 생성'
          )}
        </button>

        {dailyResults.length > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-3 space-y-2">
            <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-100">
              📋 종목/지수별 일일 리포트 결과 ({dailyResults.filter((r) => r.ok).length}/{dailyResults.length}건)
            </p>
            <ul className="space-y-1.5">
              {dailyResults.map((r) => (
                <li
                  key={`${r.market}:${r.ticker}`}
                  className="rounded-lg border border-emerald-100 dark:border-emerald-900 px-2.5 py-1.5 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {r.ok ? r.title ?? r.name : `${r.name} — 생성 실패`}
                      </p>
                      {r.ok ? (
                        <p className="text-[10px] text-gray-400 font-mono">
                          chart {r.chartFiles?.length ?? 0}장 · slide {r.slideFiles?.length ?? 0}장
                        </p>
                      ) : (
                        <p className="text-[10px] text-red-500">{r.error}</p>
                      )}
                    </div>
                    {r.ok && (
                      <div className="shrink-0 flex items-center gap-1">
                        {r.historyId && (
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/api/dashboard/content-output-html?historyId=${encodeURIComponent(r.historyId!)}`,
                                '_blank',
                              )
                            }
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition"
                          >
                            HTML 보기
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenDailyItem(r)}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 transition"
                        >
                          에디터에서 보기
                        </button>
                      </div>
                    )}
                  </div>
                  {r.ok && r.slideFiles && r.slideFiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] text-gray-400">슬라이드 HTML 변환:</span>
                      {r.slideFiles.map((f, i) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => void copySlideAsHtml(f, `${r.name} 차트 ${i + 1}`, addToast)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition"
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-gray-900 p-6 space-y-3 shadow-sm">
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
                    <button
                      type="button"
                      onClick={() => handleRemoveFocusItem(idx)}
                      aria-label={`${item.name} 제거`}
                      className="text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
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
              개별 기업명 대신 섹터/카테고리를 선택하면 해당 섹터의 구성종목 시세를 종합해 산업 분석 리포트를
              생성합니다.
            </p>
            <select
              value={selectedSectorId}
              onChange={(e) => setSelectedSectorId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 text-xs"
            >
              <option value="">섹터를 선택하세요</option>
              {STOCK_SECTORS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
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
            <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-100">
              📊 차트/슬라이드 이미지 생성 완료 — 프로젝트 폴더에서 검토해주세요
            </p>
            {focusCharts.map((c) => (
              <div key={`${c.market}:${c.ticker}`} className="text-[11px] text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">{c.name}</span>
                <span className="ml-1 text-gray-400">
                  (chart {c.chartFiles.length}장 · slide {c.slideFiles.length}장)
                </span>
                <ul className="mt-0.5 ml-3 list-disc text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                  {[...c.chartFiles, ...c.slideFiles].map((f) => (
                    <li key={f}>{f}</li>
                  ))}
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
    </div>
  )
}
