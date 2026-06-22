'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { getVsAvgColor } from '@/lib/dashboard/dashboard-helpers'
import type { NicheResearchItem, NicheResearchResult } from '@/app/api/dashboard/niche-research/route'
import type { AddToast } from '@/lib/dashboard/dashboard-types'

// ─── 상수 ─────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 9
const COMPARE_ITEMS_PER_PAGE = 6 // 비교 모드: 2열 × 3행
const MAX_HISTORY = 20
const HISTORY_KEY = 'niche-research-history'

type SortMode = 'popular' | 'recent'

// ─── 타입 ─────────────────────────────────────────────────────
interface HistoryItem {
  id: string
  keyword: string
  type: 'shorts' | 'video'
  searchedAt: string
  resultCount: number
  memo?: string
}

// ─── localStorage ──────────────────────────────────────────────
function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryItem[] }
  catch { return [] }
}
function persistHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

// ─── API 호출 공통 유틸 ───────────────────────────────────────
async function fetchNicheResearch(keyword: string, type: 'shorts' | 'video'): Promise<NicheResearchResult> {
  const params = new URLSearchParams({ keyword: keyword.trim(), type, display: '25' })
  const res = await fetch(`/api/dashboard/niche-research?${params}`)
  const data = await res.json() as NicheResearchResult & { error?: string }
  if (!res.ok) throw new Error(data.error ?? '오류가 발생했습니다')
  return data
}

// ─── 포맷 유틸 ────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}
function fmtNumber(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.floor(n / 10_000)}만`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`
  return n.toLocaleString()
}
function fmtViews(n: number | null): string { return n == null ? '-' : fmtNumber(n) }
function fmtSubs(n: number | null): string | null { return n == null ? null : fmtNumber(n) }
function subsBadge(n: number | null): { label: string; cls: string } | null {
  if (n == null) return null
  if (n < 10_000)    return { label: '소형',   cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' }
  if (n < 100_000)   return { label: '중소형', cls: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' }
  if (n < 1_000_000) return { label: '중형',   cls: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400' }
  return                    { label: '대형',   cls: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' }
}
function avg(arr: number[]) { return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0 }

// ─── 영상 카드 ────────────────────────────────────────────────
function VideoCard({ item, rank }: { item: NicheResearchItem; rank: number }) {
  const [copied, setCopied] = useState(false)
  const medals = ['🥇', '🥈', '🥉']
  const rankLabel = rank < 3 ? medals[rank] : `#${rank + 1}`

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await navigator.clipboard.writeText(item.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* 미지원 무시 */ }
  }

  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white dark:bg-gray-800">
      <div className="relative bg-gray-100 dark:bg-gray-700">
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt="" className="w-full aspect-video object-cover" /> // eslint-disable-line @next/next/no-img-element
          : <div className="w-full aspect-video flex items-center justify-center text-gray-300 dark:text-gray-600 text-4xl">🎬</div>}
        <span className="absolute top-2 left-2 bg-black/65 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-lg font-bold">{rankLabel}</span>
        {item.duration && <span className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-sm text-white text-[11px] px-1.5 py-0.5 rounded font-medium">{item.duration}</span>}
      </div>
      <div className="flex flex-col flex-1 p-3 gap-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.title}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs text-gray-400 truncate">{item.channelTitle}</p>
          {(() => {
            const subs = fmtSubs(item.subscriberCount); const badge = subsBadge(item.subscriberCount)
            if (!subs) return null
            return <span className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] text-gray-400">구독자 {subs}</span>
              {badge && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>}
            </span>
          })()}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-bold text-gray-700 dark:text-gray-300">👁 {fmtViews(item.viewCount)}</span>
          {item.publishedAt && <span>📅 {item.publishedAt}</span>}
          {item.vsAvg != null && <span className={`ml-auto font-bold ${getVsAvgColor(item.vsAvg)}`}>{item.vsAvg.toFixed(1)}x</span>}
        </div>
        <button type="button" onClick={handleCopy}
          className={`mt-1.5 w-full text-[11px] font-semibold py-1.5 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400'}`}>
          {copied ? '✓ URL 복사됨' : '🔗 URL 복사'}
        </button>
      </div>
    </a>
  )
}

// ─── 스켈레톤 ─────────────────────────────────────────────────
function SkeletonGrid({ cols = 3 }: { cols?: 2 | 3 }) {
  const count = cols === 2 ? 6 : 9
  const gridCls = cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  return (
    <div className={`grid ${gridCls} gap-4`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="aspect-video bg-gray-100 dark:bg-gray-700 animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 페이지네이션 ─────────────────────────────────────────────
function Pagination({ page, totalPages, total, sort, onChange }: {
  page: number; totalPages: number; total: number; sort: SortMode; onChange: (p: number) => void
}) {
  const start = (page - 1) * ITEMS_PER_PAGE + 1
  const end = Math.min(page * ITEMS_PER_PAGE, total)
  const sortLabel = sort === 'popular' ? '인기순' : '최신순'
  if (totalPages <= 1) return <p className="text-xs text-gray-400 text-center">총 {total}개 · {sortLabel} · YouTube Data API v3</p>
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-400">{start}–{end} / 총 {total}개 · {sortLabel}</p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">← 이전</button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} type="button" onClick={() => onChange(p)}
            className={`w-7 h-7 text-xs font-semibold rounded-lg transition ${p === page ? 'bg-blue-500 text-white' : 'border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{p}</button>
        ))}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">다음 →</button>
      </div>
    </div>
  )
}

// ─── 히스토리 칩 (메모 인라인 편집) ─────────────────────────
function HistoryChip({ item, onSelect, onDelete, onMemoSave }: {
  item: HistoryItem
  onSelect: (h: HistoryItem) => void
  onDelete: (id: string) => void
  onMemoSave: (id: string, memo: string) => void
}) {
  const [editingMemo, setEditingMemo] = useState(false)
  const [memoText, setMemoText] = useState(item.memo ?? '')

  const saveMemo = () => {
    onMemoSave(item.id, memoText.trim())
    setEditingMemo(false)
  }

  return (
    <div className="group/chip flex flex-col">
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl pl-3 pr-1.5 py-1.5">
        {/* 메인 칩 버튼 */}
        <button type="button" onClick={() => onSelect(item)}
          className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition min-w-0">
          <span>{item.type === 'shorts' ? '📱' : '🎬'}</span>
          <span className="font-semibold truncate max-w-[80px]">{item.keyword}</span>
          <span className="text-gray-400 text-[10px] shrink-0">{item.resultCount}개</span>
          <span className="text-gray-300 dark:text-gray-500 text-[10px] shrink-0">·</span>
          <span className="text-gray-400 text-[10px] shrink-0">{relativeTime(item.searchedAt)}</span>
        </button>
        {/* 메모 버튼 */}
        <button type="button" onClick={() => { setEditingMemo(e => !e); setMemoText(item.memo ?? '') }}
          title="메모 편집"
          className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] transition ${editingMemo || item.memo ? 'text-yellow-500 opacity-100' : 'text-gray-300 dark:text-gray-500 opacity-0 group-hover/chip:opacity-100'} hover:bg-yellow-100 dark:hover:bg-yellow-900/30`}>
          ✏️
        </button>
        {/* 삭제 버튼 */}
        <button type="button" onClick={() => onDelete(item.id)} aria-label="히스토리 삭제"
          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition opacity-0 group-hover/chip:opacity-100">
          ×
        </button>
      </div>

      {/* 메모 표시 */}
      {item.memo && !editingMemo && (
        <p className="text-[10px] text-yellow-600 dark:text-yellow-400 pl-3 mt-0.5 cursor-pointer truncate max-w-[200px]"
          onClick={() => { setEditingMemo(true); setMemoText(item.memo ?? '') }}>
          📝 {item.memo}
        </p>
      )}

      {/* 메모 편집 입력 */}
      {editingMemo && (
        <input
          autoFocus
          value={memoText}
          onChange={e => setMemoText(e.target.value)}
          onBlur={saveMemo}
          onKeyDown={e => { if (e.key === 'Enter') saveMemo(); if (e.key === 'Escape') setEditingMemo(false) }}
          placeholder="메모 입력 (Enter 저장, Esc 취소)"
          className="mt-1 text-[11px] px-2.5 py-1.5 border border-yellow-300 dark:border-yellow-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 w-full"
        />
      )}
    </div>
  )
}

// ─── 히스토리 패널 ────────────────────────────────────────────
function HistoryPanel({ history, onSelect, onDelete, onClearAll, onMemoSave }: {
  history: HistoryItem[]
  onSelect: (h: HistoryItem) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onMemoSave: (id: string, memo: string) => void
}) {
  if (history.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">최근 검색</span>
        <button type="button" onClick={onClearAll} className="text-[11px] text-gray-400 hover:text-red-500 transition">전체 삭제</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map(h => (
          <HistoryChip key={h.id} item={h} onSelect={onSelect} onDelete={onDelete} onMemoSave={onMemoSave} />
        ))}
      </div>
    </div>
  )
}

// ─── 비교 요약 카드 ───────────────────────────────────────────
function ComparisonSummary({ a, b }: { a: NicheResearchResult; b: NicheResearchResult }) {
  const calc = (items: NicheResearchItem[]) => ({
    count: items.length,
    avgViews: avg(items.map(i => i.viewCount ?? 0)),
    avgVsAvg: avg(items.filter(i => i.vsAvg != null).map(i => i.vsAvg!)),
    smallRatio: items.length ? items.filter(i => (i.subscriberCount ?? Infinity) < 100_000).length / items.length : 0,
  })
  const ma = calc(a.items)
  const mb = calc(b.items)

  const metrics: { label: string; aVal: string; bVal: string; aWins: boolean }[] = [
    { label: '영상 수', aVal: `${ma.count}개`, bVal: `${mb.count}개`, aWins: ma.count >= mb.count },
    { label: '평균 조회수', aVal: fmtViews(Math.round(ma.avgViews)), bVal: fmtViews(Math.round(mb.avgViews)), aWins: ma.avgViews >= mb.avgViews },
    { label: '평균 vsAvg', aVal: `${ma.avgVsAvg.toFixed(1)}x`, bVal: `${mb.avgVsAvg.toFixed(1)}x`, aWins: ma.avgVsAvg >= mb.avgVsAvg },
    { label: '소형채널 비율', aVal: `${Math.round(ma.smallRatio * 100)}%`, bVal: `${Math.round(mb.smallRatio * 100)}%`, aWins: ma.smallRatio >= mb.smallRatio },
  ]

  const aScore = metrics.filter(m => m.aWins).length
  const verdict = aScore >= 3 ? { side: 'A', keyword: a.keyword, cls: 'text-blue-600' }
    : aScore <= 1 ? { side: 'B', keyword: b.keyword, cls: 'text-purple-600' }
    : null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-100 dark:border-blue-800/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">⚖️ 비교 요약</p>
        {verdict && (
          <p className={`text-xs font-bold ${verdict.cls}`}>
            {verdict.side === 'A' ? '🟦' : '🟣'} &ldquo;{verdict.keyword}&rdquo; 니치가 우세
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-1">{m.label}</p>
            <div className="flex items-center justify-center gap-2 text-xs font-bold">
              <span className={m.aWins ? 'text-blue-600' : 'text-gray-400'}>{m.aVal}</span>
              <span className="text-gray-300 text-[10px]">vs</span>
              <span className={!m.aWins ? 'text-purple-600' : 'text-gray-400'}>{m.bVal}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 비교 패널 (A/B 각 사이드) ───────────────────────────────
function ComparePane({
  side,
  accentCls,
  headerBg,
  addToHistory,
  onResultChange,
}: {
  side: 'A' | 'B'
  accentCls: string
  headerBg: string
  addToHistory: (kw: string, t: 'shorts' | 'video', count: number) => void
  onResultChange: (result: NicheResearchResult | null) => void
}) {
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<'shorts' | 'video'>('shorts')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NicheResearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortMode>('popular')

  const doSearch = async (kw: string, t: 'shorts' | 'video') => {
    kw = kw.trim()
    if (!kw) return
    setLoading(true); setError(null); setResult(null); setPage(1); setSort('popular')
    try {
      const data = await fetchNicheResearch(kw, t)
      setResult(data)
      onResultChange(data)
      addToHistory(kw, t, data.items?.length ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
      onResultChange(null)
    } finally {
      setLoading(false)
    }
  }
  const search = () => doSearch(keyword, type)

  const sortedItems = useMemo<NicheResearchItem[]>(() => {
    if (!result) return []
    const items = [...result.items]
    if (sort === 'recent') return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    return items.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
  }, [result, sort])

  const totalPages = Math.ceil(sortedItems.length / COMPARE_ITEMS_PER_PAGE)
  const pageItems = sortedItems.slice((page - 1) * COMPARE_ITEMS_PER_PAGE, page * COMPARE_ITEMS_PER_PAGE)

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* 사이드 헤더 */}
      <div className={`${headerBg} rounded-xl px-4 py-2.5 flex items-center gap-2`}>
        <span className={`text-sm font-black ${accentCls}`}>{side}</span>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">니치</span>
      </div>

      {/* 검색 입력 */}
      <div className="flex gap-2">
        <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden text-xs font-semibold shrink-0">
          {(['shorts', 'video'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`px-2.5 py-2 transition ${type === t ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              {t === 'shorts' ? '📱' : '🎬'}
            </button>
          ))}
        </div>
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={`키워드 ${side}`}
          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button type="button" onClick={search} disabled={loading || !keyword.trim()}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition shrink-0">
          {loading ? '…' : '탐색'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
      {loading && <SkeletonGrid cols={2} />}

      {result && !loading && (
        <div className="space-y-4">
          {/* AI 인사이트 */}
          {result.insight && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-1">🤖 &ldquo;{result.keyword}&rdquo; 패턴</p>
              <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed line-clamp-4">{result.insight}</p>
              {result.subNiches?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.subNiches.slice(0, 4).map(n => (
                    <button key={n} type="button"
                      onClick={() => { setKeyword(n); doSearch(n, type) }}
                      className="text-[10px] font-semibold px-2 py-0.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-600 rounded-md hover:bg-blue-500 hover:text-white transition">
                      🔍 {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 정렬 + 결과 수 */}
          {sortedItems.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">{sortedItems.length}개</p>
              <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden text-[11px] font-semibold">
                {([['popular', '🔥 인기'], ['recent', '🕐 최신']] as [SortMode, string][]).map(([mode, label]) => (
                  <button key={mode} type="button" onClick={() => { setSort(mode); setPage(1) }}
                    className={`px-2.5 py-1 transition ${sort === mode ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 카드 그리드 (2열) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pageItems.map((item, i) => (
              <VideoCard key={item.videoId} item={item} rank={(page - 1) * COMPARE_ITEMS_PER_PAGE + i} />
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition">←</button>
              <span className="text-xs text-gray-400 px-2">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition">→</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 패널 ────────────────────────────────────────────────
export function NicheResearchPanel({ defaultExpanded = false, addToast }: { defaultExpanded?: boolean; addToast?: AddToast }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [compareMode, setCompareMode] = useState(false)

  // 단일 검색 상태
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState<'shorts' | 'video'>('shorts')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NicheResearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortMode>('popular')

  // 히스토리
  const [history, setHistory] = useState<HistoryItem[]>([])
  useEffect(() => { setHistory(loadHistory()) }, [])

  // 비교 결과 (각 패인에서 올라옴)
  const [compareResultA, setCompareResultA] = useState<NicheResearchResult | null>(null)
  const [compareResultB, setCompareResultB] = useState<NicheResearchResult | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const addToHistory = useCallback((kw: string, t: 'shorts' | 'video', count: number) => {
    const item: HistoryItem = { id: `${t}-${kw}-${Date.now()}`, keyword: kw, type: t, searchedAt: new Date().toISOString(), resultCount: count }
    setHistory(prev => {
      const next = [item, ...prev.filter(h => !(h.keyword === kw && h.type === t))].slice(0, MAX_HISTORY)
      persistHistory(next)
      return next
    })
  }, [])

  const deleteHistory = useCallback((id: string) => {
    setHistory(prev => { const next = prev.filter(h => h.id !== id); persistHistory(next); return next })
  }, [])

  const clearHistory = useCallback(() => { setHistory([]); persistHistory([]) }, [])

  const saveMemo = useCallback((id: string, memo: string) => {
    setHistory(prev => {
      const next = prev.map(h => h.id === id ? { ...h, memo: memo || undefined } : h)
      persistHistory(next)
      return next
    })
  }, [])

  const runSearch = useCallback(async (kw: string, t: 'shorts' | 'video') => {
    if (!kw.trim()) { inputRef.current?.focus(); return }
    setLoading(true); setError(null); setResult(null); setPage(1); setSort('popular')
    try {
      const data = await fetchNicheResearch(kw, t)
      setResult(data)
      addToHistory(kw.trim(), t, data.items?.length ?? 0)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류가 발생했습니다'
      setError(msg)
      addToast?.(msg, 'error', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToHistory, addToast])

  const handleSearch = () => runSearch(keyword, type)
  const handleSubNicheSearch = (niche: string) => { setKeyword(niche); runSearch(niche, type) }
  const handleHistorySelect = (h: HistoryItem) => { setKeyword(h.keyword); setType(h.type); runSearch(h.keyword, h.type) }

  const sortedItems = useMemo<NicheResearchItem[]>(() => {
    if (!result) return []
    const items = [...result.items]
    if (sort === 'recent') return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    return items.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
  }, [result, sort])

  const handleSortChange = (next: SortMode) => { setSort(next); setPage(1) }
  const handlePageChange = (p: number) => {
    setPage(p)
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE)
  const pageItems = sortedItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const switchToCompare = () => {
    setCompareMode(true)
    setCompareResultA(null)
    setCompareResultB(null)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
      {/* 헤더 토글 */}
      <button type="button" onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
        <span className="flex items-center gap-2 min-w-0">
          <span>🔍</span>
          <span className="shrink-0">니치 탐색</span>
          <span className="text-xs font-normal text-gray-400 truncate">YouTube 전체 검색 · AI 패턴 분석</span>
          {history.length > 0 && (
            <span className="shrink-0 text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md">
              히스토리 {history.length}
            </span>
          )}
        </span>
        <span className={`text-gray-400 text-xs transition-transform duration-200 shrink-0 ml-2 ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {expanded && (
        <div className="px-5 pb-6 space-y-4 border-t border-gray-100 dark:border-gray-700">

          {/* ── 비교 모드 ─────────────────────────────────── */}
          {compareMode ? (
            <div className="space-y-4 pt-4">
              {/* 비교 모드 헤더 */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">⚖️ 니치 비교 모드</p>
                <button type="button" onClick={() => setCompareMode(false)}
                  className="text-xs text-gray-400 hover:text-red-500 transition font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-red-300">
                  ✕ 비교 종료
                </button>
              </div>

              {/* 비교 요약 */}
              {compareResultA && compareResultB && (
                <ComparisonSummary a={compareResultA} b={compareResultB} />
              )}

              {/* A / B 패널 */}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  <ComparePane side="A" accentCls="text-blue-600" headerBg="bg-blue-50 dark:bg-blue-900/20"
                    addToHistory={addToHistory} onResultChange={setCompareResultA} />
                </div>
                <div className="w-px bg-gray-200 dark:bg-gray-700 hidden md:block shrink-0" />
                <div className="flex-1 min-w-0">
                  <ComparePane side="B" accentCls="text-purple-600" headerBg="bg-purple-50 dark:bg-purple-900/20"
                    addToHistory={addToHistory} onResultChange={setCompareResultB} />
                </div>
              </div>
            </div>

          ) : (
            /* ── 단일 검색 모드 ─────────────────────────── */
            <>
              {/* 검색 입력 */}
              <div className="flex gap-2 pt-4 flex-wrap sm:flex-nowrap">
                <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden text-xs font-semibold shrink-0">
                  {(['shorts', 'video'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setType(t)}
                      className={`px-3 py-2 transition ${type === t ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {t === 'shorts' ? '📱 Shorts' : '🎬 영상'}
                    </button>
                  ))}
                </div>
                <input ref={inputRef} type="text" value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="니치 키워드 (예: 고양이, 먹방, 브이로그)"
                  className="flex-1 min-w-0 px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={handleSearch} disabled={loading || !keyword.trim()}
                  className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shrink-0">
                  {loading ? '분석 중…' : '탐색'}
                </button>
                <button type="button" onClick={switchToCompare}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition shrink-0"
                  title="두 키워드를 나란히 비교">
                  ⚖️ 비교
                </button>
              </div>

              {/* 히스토리 */}
              <HistoryPanel history={history} onSelect={handleHistorySelect} onDelete={deleteHistory} onClearAll={clearHistory} onMemoSave={saveMemo} />

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>}
              {loading && <div className="space-y-4"><div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" /><SkeletonGrid /></div>}

              {result && !loading && (
                <div className="space-y-5" ref={resultsRef}>
                  {result.cached && (
                    <p className="text-xs text-gray-400 text-right">
                      📦 캐시 · {new Date(result.cachedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 기준 · 2시간 유지
                    </p>
                  )}

                  {/* AI 인사이트 + 서브니치 */}
                  {(result.insight || result.subNiches?.length > 0) && (
                    <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
                      <span className="text-lg shrink-0 mt-0.5">🤖</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">&ldquo;{result.keyword}&rdquo; 니치 패턴 분석</p>
                        {result.insight && <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{result.insight}</p>}
                        {result.subNiches?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700/50">
                            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-2">💡 연관 서브니치 — 클릭하면 바로 탐색</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.subNiches.map(niche => (
                                <button key={niche} type="button" onClick={() => handleSubNicheSearch(niche)}
                                  className="text-[11px] font-semibold px-2.5 py-1 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-600 rounded-lg hover:bg-blue-500 hover:text-white hover:border-blue-500 dark:hover:bg-blue-600 dark:hover:border-blue-600 dark:hover:text-white transition">
                                  🔍 {niche}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sortedItems.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">검색 결과가 없습니다.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{sortedItems.length}개 영상</p>
                        <div className="flex border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden text-xs font-semibold">
                          {([['popular', '🔥 인기순'], ['recent', '🕐 최신순']] as [SortMode, string][]).map(([mode, label]) => (
                            <button key={mode} type="button" onClick={() => handleSortChange(mode)}
                              className={`px-3 py-1.5 transition ${sort === mode ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pageItems.map((item, i) => (
                          <VideoCard key={item.videoId} item={item} rank={(page - 1) * ITEMS_PER_PAGE + i} />
                        ))}
                      </div>
                      <Pagination page={page} totalPages={totalPages} total={sortedItems.length} sort={sort} onChange={handlePageChange} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
