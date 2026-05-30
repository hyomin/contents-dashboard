'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { usePlanningQueue } from '@/lib/hooks/use-planning-queue'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

// ─── 타입 ───────────────────────────────────────────────────
type PlatformTab = 'youtube' | 'naver' | 'tistory' | 'rss'
type FormatTab = 'all' | 'short' | 'long'
type PeriodTab = 'all' | '7d' | '30d' | '90d'

interface TrendingResponse {
  byFormat: {
    all: TrendingKeyword[]
    short: TrendingKeyword[]
    long: TrendingKeyword[]
  }
  cached: boolean
}

interface ChannelCategory {
  id: string
  name: string
  icon: string
  bg_color: string
}

interface NaverBlogItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

interface TistoryItem {
  title: string
  link: string
  description: string
  blogId: string
  blogHome: string
}

interface RssTopic {
  id: string
  title: string
  ai_title: string | null
  ai_reason: string | null
  sources: string[]
  sourceCount: number
  isTrending: boolean
  categories: string[]
  link: string | null
  collected_at: string
  relevance_score: number
}

interface RssTrendingResponse {
  trending: RssTopic[]
  allTopics: RssTopic[]
  categoryStats: { category: string; count: number; trendingCount: number }[]
  totalFeeds: number
  activeFeeds: number
}

// ─── 공통 상수 ───────────────────────────────────────────────
const PERIOD_LABELS: Record<PeriodTab, string> = {
  all: '전체',
  '7d': '7일',
  '30d': '30일',
  '90d': '90일',
}

const FORMAT_LABELS: Record<FormatTab, string> = {
  all: '전체',
  short: '📱 Shorts',
  long: '🎬 Long',
}

// ─── 플랫폼 탭 정의 ──────────────────────────────────────────
const PLATFORM_TABS: {
  id: PlatformTab
  label: string
  activeClass: string
  inactiveHover: string
}[] = [
  {
    id: 'youtube',
    label: '📺 YouTube',
    activeClass: 'bg-red-500 text-white border-red-500',
    inactiveHover: 'hover:border-red-300 hover:text-red-600',
  },
  {
    id: 'naver',
    label: '🟢 네이버 블로그',
    activeClass: 'bg-green-600 text-white border-green-600',
    inactiveHover: 'hover:border-green-400 hover:text-green-700',
  },
  {
    id: 'tistory',
    label: '🟠 티스토리',
    activeClass: 'bg-orange-500 text-white border-orange-500',
    inactiveHover: 'hover:border-orange-400 hover:text-orange-700',
  },
  {
    id: 'rss',
    label: '📰 RSS·뉴스',
    activeClass: 'bg-blue-600 text-white border-blue-600',
    inactiveHover: 'hover:border-blue-400 hover:text-blue-600',
  },
]

// ─── YouTube 섹션 ─────────────────────────────────────────────
function YouTubeSection({ addToast }: { addToast: AddToast }) {
  const [response, setResponse] = useState<TrendingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [format, setFormat] = useState<FormatTab>('all')
  const [period, setPeriod] = useState<PeriodTab>('all')
  const { addItem: addToQueue, items: queueItems } = usePlanningQueue()

  const fetchData = useCallback(
    (p: PeriodTab) => {
      setLoading(true)
      const params = new URLSearchParams({ limit: '20' })
      if (p !== 'all') params.set('period', p)
      fetch(`/api/dashboard/trending?${params}`)
        .then((r) => r.json())
        .then((d: TrendingResponse) => setResponse(d))
        .catch(() => addToast('키워드 로드 실패', 'warning'))
        .finally(() => setLoading(false))
    },
    [addToast],
  )

  useEffect(() => {
    fetchData(period)
  }, [period, fetchData])

  const keywords: TrendingKeyword[] = response
    ? format === 'short'
      ? response.byFormat.short
      : format === 'long'
        ? response.byFormat.long
        : response.byFormat.all
    : []

  const maxCount = Math.max(...keywords.map((k) => k.count), 1)

  return (
    <div className="space-y-4">
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* 포맷 서브탭 */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {(['all', 'short', 'long'] as FormatTab[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition ${
                format === f
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {FORMAT_LABELS[f]}
              {!loading && response && (
                <span className="ml-1 opacity-70">
                  (
                  {f === 'short'
                    ? response.byFormat.short.length
                    : f === 'long'
                      ? response.byFormat.long.length
                      : response.byFormat.all.length}
                  )
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 기간 필터 */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {(['7d', '30d', '90d', 'all'] as PeriodTab[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                period === p
                  ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Shorts vs Long 병렬 비교 (전체 모드일 때) */}
      {!loading && format === 'all' && response && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['short', 'long'] as const).map((fmt) => {
            const kws = fmt === 'short' ? response.byFormat.short : response.byFormat.long
            const maxC = Math.max(...kws.map((k) => k.count), 1)
            return (
              <div
                key={fmt}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <div
                  className={`px-4 py-3 border-b ${
                    fmt === 'short'
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      fmt === 'short'
                        ? 'text-purple-700 dark:text-purple-300'
                        : 'text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {FORMAT_LABELS[fmt]} 키워드
                    <span className="ml-2 text-xs font-normal opacity-60">{kws.length}개</span>
                  </span>
                </div>
                {kws.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">데이터 없음</p>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {kws.slice(0, 10).map((kw) => (
                      <div
                        key={kw.keyword}
                        className="relative px-4 py-2.5 flex items-center gap-2.5 group"
                      >
                        {/* 배경 바 */}
                        <div
                          className={`absolute inset-y-0 left-0 transition-all ${
                            fmt === 'short' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                          }`}
                          style={{ width: `${(kw.count / maxC) * 100}%` }}
                        />
                        {/* 순위 */}
                        <span
                          className={`relative shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                            kw.rank === 1
                              ? 'bg-yellow-400 text-white'
                              : kw.rank === 2
                                ? 'bg-gray-300 text-gray-700'
                                : kw.rank === 3
                                  ? 'bg-orange-400 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                          }`}
                        >
                          {kw.rank}
                        </span>
                        <span className="relative flex-1 text-xs font-semibold text-gray-900 dark:text-white truncate">
                          #{kw.keyword}
                        </span>
                        <span className="relative text-[11px] text-gray-400">{kw.count}회</span>
                        <button
                          type="button"
                          onClick={() => {
                            addToQueue(kw.keyword, 'trending')
                          }}
                          className={`relative text-[10px] px-2 py-0.5 rounded-md transition opacity-0 group-hover:opacity-100 ${
                            fmt === 'short'
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          +큐
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 전체/숏폼/롱폼 단일 목록 */}
      {(loading || format !== 'all') && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-11 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : keywords.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-sm">
                {format !== 'all'
                  ? `${FORMAT_LABELS[format]} 영상 데이터가 없습니다.`
                  : '수집된 영상이 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {keywords.map((kw) => (
                <div
                  key={kw.keyword}
                  className="relative px-5 py-3.5 flex items-center gap-3 group hover:bg-red-50/40 dark:hover:bg-red-900/10 transition"
                >
                  {/* 배경 바 차트 */}
                  <div
                    className="absolute inset-y-0 left-0 bg-red-50 dark:bg-red-900/10"
                    style={{ width: `${(kw.count / maxCount) * 100}%` }}
                  />
                  {/* 순위 */}
                  <span
                    className={`relative shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                      kw.rank === 1
                        ? 'bg-yellow-400 text-white'
                        : kw.rank === 2
                          ? 'bg-gray-300 text-gray-700'
                          : kw.rank === 3
                            ? 'bg-orange-400 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {kw.rank}
                  </span>
                  <span className="relative flex-1 text-sm font-semibold text-gray-900 dark:text-white">
                    #{kw.keyword}
                  </span>
                  <span className="relative text-xs text-gray-400">{kw.count}회</span>
                  <div className="relative">
                    {queueItems.some((q) => q.keyword === kw.keyword) ? (
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-600 text-xs rounded-lg font-medium">
                        ✓ 큐
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const added = addToQueue(kw.keyword, 'trending')
                          addToast(
                            added
                              ? `"${kw.keyword}" 기획 큐에 추가됨 ✓`
                              : `"${kw.keyword}"은 이미 큐에 있습니다`,
                            added ? 'success' : 'warning',
                          )
                        }}
                        className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition opacity-0 group-hover:opacity-100"
                      >
                        + 기획 추가
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 블로그 공통 카드 렌더러 ──────────────────────────────────
function BlogItemCard({
  idx,
  title,
  link,
  description,
  authorLabel,
  authorLink,
  meta,
  accentClass,
}: {
  idx: number
  title: string
  link: string
  description: string
  authorLabel: string
  authorLink?: string
  meta?: string
  accentClass: string
}) {
  return (
    <div className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">
      <div className="flex items-start gap-2.5">
        <span
          className={`shrink-0 w-5 h-5 rounded-full ${accentClass} text-[10px] font-bold flex items-center justify-center mt-0.5`}
        >
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-900 dark:text-white hover:underline line-clamp-1"
          >
            {title}
          </a>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{description}</p>
          <div className="flex items-center gap-2.5 mt-1.5 text-[11px] flex-wrap">
            {authorLink ? (
              <a
                href={authorLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline text-gray-700 dark:text-gray-300"
              >
                ✍️ {authorLabel}
              </a>
            ) : (
              <span className="font-medium text-gray-700 dark:text-gray-300">✍️ {authorLabel}</span>
            )}
            {meta && <span className="text-gray-400">{meta}</span>}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-blue-400 hover:underline"
            >
              글 보기 ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 카테고리 선택 공통 UI ───────────────────────────────────
function CategoryChips({
  categories,
  activeCatId,
  onSelect,
  accentActive,
}: {
  categories: ChannelCategory[]
  activeCatId: string | null
  onSelect: (cat: ChannelCategory) => void
  accentActive: string
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat)}
          className={`px-3 py-1.5 text-xs rounded-full font-medium transition border ${
            activeCatId === cat.id
              ? `${accentActive} border-transparent`
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'
          }`}
        >
          {cat.icon} {cat.name}
        </button>
      ))}
    </div>
  )
}

// ─── 블로그 결과 래퍼 ────────────────────────────────────────
function BlogResultPanel({
  headerLabel,
  headerBg,
  total,
  loading,
  error,
  noCats,
  children,
}: {
  headerLabel: string
  headerBg: string
  total: number
  loading: boolean
  error: string
  noCats: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div
        className={`px-5 py-3 border-b border-white/20 flex items-center justify-between ${headerBg}`}
      >
        <span className="text-sm font-bold">{headerLabel}</span>
        {total > 0 && <span className="text-xs opacity-60">{total.toLocaleString()}건</span>}
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">
          <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          검색 중…
        </div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">❌ {error}</div>
      ) : noCats ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          채널 등록 탭에서 카테고리를 설정하면 여기서 확인할 수 있습니다.
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// ─── 네이버 블로그 섹션 ──────────────────────────────────────
function NaverBlogSection() {
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [catsLoading, setCatsLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<ChannelCategory | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [items, setItems] = useState<NaverBlogItem[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const initialized = useRef(false)

  const fetchBlog = useCallback(async (keyword: string) => {
    setSearchLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/dashboard/naver-blog-search?keyword=${encodeURIComponent(keyword)}&display=10&sort=date`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '검색 오류')
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('네트워크 오류')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/dashboard/channel-categories')
      .then((r) => r.json())
      .then((data: ChannelCategory[]) => {
        setCategories(data)
        if (data.length > 0 && !initialized.current) {
          initialized.current = true
          setActiveCat(data[0])
          void fetchBlog(data[0].name)
        }
      })
      .catch(() => {})
      .finally(() => setCatsLoading(false))
  }, [fetchBlog])

  const handleCatClick = (cat: ChannelCategory) => {
    setActiveCat(cat)
    void fetchBlog(cat.name)
  }

  if (catsLoading) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm animate-pulse">카테고리 로딩 중…</div>
    )
  }

  return (
    <div className="space-y-4">
      <CategoryChips
        categories={categories}
        activeCatId={activeCat?.id ?? null}
        onSelect={handleCatClick}
        accentActive="bg-green-600 text-white"
      />
      <BlogResultPanel
        headerLabel={
          activeCat
            ? `${activeCat.icon} ${activeCat.name} · 최신 네이버 블로그`
            : '🟢 네이버 블로그 · 최신글'
        }
        headerBg="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
        total={total}
        loading={searchLoading}
        error={error}
        noCats={categories.length === 0}
      >
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">결과 없음</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
            {items.map((item, idx) => (
              <BlogItemCard
                key={idx}
                idx={idx}
                title={item.title}
                link={item.link}
                description={item.description}
                authorLabel={item.bloggername}
                authorLink={
                  item.bloggerlink
                    ? item.bloggerlink.startsWith('http')
                      ? item.bloggerlink
                      : `https://${item.bloggerlink}`
                    : undefined
                }
                meta={item.postdate}
                accentClass="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
              />
            ))}
            <div className="px-5 py-2 text-[11px] text-gray-400 text-right bg-gray-50 dark:bg-gray-700/40">
              네이버 블로그 · 최신 등록 순 · 상위 {items.length}개
            </div>
          </div>
        )}
      </BlogResultPanel>
    </div>
  )
}

// ─── 티스토리 섹션 ───────────────────────────────────────────
function TistorySection() {
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [catsLoading, setCatsLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<ChannelCategory | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [items, setItems] = useState<TistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const initialized = useRef(false)

  const fetchTistory = useCallback(async (keyword: string) => {
    setSearchLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/dashboard/tistory-search?keyword=${encodeURIComponent(keyword)}&display=10`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '검색 오류')
        return
      }
      setItems(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('네트워크 오류')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/dashboard/channel-categories')
      .then((r) => r.json())
      .then((data: ChannelCategory[]) => {
        setCategories(data)
        if (data.length > 0 && !initialized.current) {
          initialized.current = true
          setActiveCat(data[0])
          void fetchTistory(data[0].name)
        }
      })
      .catch(() => {})
      .finally(() => setCatsLoading(false))
  }, [fetchTistory])

  const handleCatClick = (cat: ChannelCategory) => {
    setActiveCat(cat)
    void fetchTistory(cat.name)
  }

  if (catsLoading) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm animate-pulse">카테고리 로딩 중…</div>
    )
  }

  return (
    <div className="space-y-4">
      <CategoryChips
        categories={categories}
        activeCatId={activeCat?.id ?? null}
        onSelect={handleCatClick}
        accentActive="bg-orange-500 text-white"
      />
      <BlogResultPanel
        headerLabel={
          activeCat
            ? `${activeCat.icon} ${activeCat.name} · 최신 티스토리`
            : '🟠 티스토리 · 최신글'
        }
        headerBg="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300"
        total={total}
        loading={searchLoading}
        error={error}
        noCats={categories.length === 0}
      >
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">결과 없음</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/60">
            {items.map((item, idx) => (
              <BlogItemCard
                key={idx}
                idx={idx}
                title={item.title}
                link={item.link}
                description={item.description}
                authorLabel={`${item.blogId}.tistory.com`}
                authorLink={item.blogHome}
                accentClass="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400"
              />
            ))}
            <div className="px-5 py-2 text-[11px] text-gray-400 text-right bg-gray-50 dark:bg-gray-700/40">
              티스토리 · 관련도 순 · 상위 {items.length}개
            </div>
          </div>
        )}
      </BlogResultPanel>
    </div>
  )
}

// ─── RSS·뉴스 섹션 ────────────────────────────────────────────
type RssPeriodTab = '7' | '14' | '30'
const RSS_PERIOD_LABELS: Record<RssPeriodTab, string> = { '7': '7일', '14': '14일', '30': '30일' }

function RssSection() {
  const [data, setData] = useState<RssTrendingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<RssPeriodTab>('7')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const fetchRss = useCallback((p: RssPeriodTab, cat: string | null) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '60', days: p })
    if (cat) params.set('category', cat)
    fetch(`/api/dashboard/rss-trending?${params}`)
      .then((r) => r.json())
      .then((d: RssTrendingResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchRss(period, activeCat)
  }, [period, activeCat, fetchRss])

  const displayTopics = data
    ? showAll
      ? data.allTopics
      : data.trending.length > 0
        ? data.trending
        : data.allTopics
    : []

  return (
    <div className="space-y-4">
      {/* 컨트롤 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* 기간 */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {(['7', '14', '30'] as RssPeriodTab[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                period === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {RSS_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* 전체/급상승 토글 */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              !showAll ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔥 급상승
            {data && <span className="ml-1 opacity-70">({data.trending.length})</span>}
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              showAll ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            전체
            {data && <span className="ml-1 opacity-70">({data.allTopics.length})</span>}
          </button>
        </div>
      </div>

      {/* 카테고리 필터 칩 */}
      {data && data.categoryStats.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveCat(null)}
            className={`px-3 py-1 text-xs rounded-full border font-medium transition ${
              activeCat === null
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
            }`}
          >
            전체
          </button>
          {data.categoryStats.slice(0, 8).map((s) => (
            <button
              key={s.category}
              type="button"
              onClick={() => setActiveCat(s.category === activeCat ? null : s.category)}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition ${
                activeCat === s.category
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
              }`}
            >
              {s.category}
              <span className="ml-1 opacity-60">{s.count}</span>
              {s.trendingCount > 0 && (
                <span className="ml-1 text-red-500">🔥{s.trendingCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* RSS 토픽 카드 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : displayTopics.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-2xl mb-3">📭</p>
            <p className="text-sm">수집된 RSS 토픽이 없습니다.</p>
            <p className="text-xs mt-1 text-gray-300">RSS 데이터 수집 후 표시됩니다.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {displayTopics.slice(0, 30).map((topic) => (
                <div
                  key={topic.id}
                  className="px-5 py-4 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition"
                >
                  <div className="flex items-start gap-3">
                    {/* 급상승 뱃지 */}
                    <div className="shrink-0 mt-0.5">
                      {topic.isTrending ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-md">
                          🔥 {topic.sourceCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 text-[10px] rounded-md">
                          {topic.sourceCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* 제목 */}
                      {topic.link ? (
                        <a
                          href={topic.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 hover:underline line-clamp-2"
                        >
                          {topic.ai_title ?? topic.title}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                          {topic.ai_title ?? topic.title}
                        </p>
                      )}
                      {/* AI 요약 */}
                      {topic.ai_reason && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{topic.ai_reason}</p>
                      )}
                      {/* 메타 */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {topic.categories.map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md font-medium"
                          >
                            {cat}
                          </span>
                        ))}
                        <span className="text-[11px] text-gray-400 ml-auto">
                          {new Date(topic.collected_at).toLocaleDateString('ko', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {topic.link && (
                          <a
                            href={topic.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:underline"
                          >
                            원문 ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/40 text-[11px] text-gray-400 text-right">
              {data?.activeFeeds ?? 0}/{data?.totalFeeds ?? 0} 피드 활성 · 최근 {RSS_PERIOD_LABELS[period]}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function TrendingView({ addToast }: { addToast: AddToast }) {
  const [platform, setPlatform] = useState<PlatformTab>('youtube')

  return (
    <div className="space-y-5">
      <N8nLv1ServicesSection viewId="trending" addToast={addToast} />

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-5 sm:p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <TitleWithHint
              as="h2"
              className="text-lg font-bold"
              hintVariant="light"
              hint="YouTube는 수집된 영상 제목에서 키워드를 추출합니다. 네이버·티스토리는 카테고리별 실시간 최신글을, RSS·뉴스는 여러 피드에서 중복 언급된 급상승 주제를 보여줍니다."
            >
              🔥 트렌딩 분석
            </TitleWithHint>
            <p className="text-sm opacity-80 mt-1">
              플랫폼·형식별 인기 키워드와 트렌딩 콘텐츠를 확인합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 플랫폼 탭 */}
      <div className="flex gap-2 flex-wrap">
        {PLATFORM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPlatform(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
              platform === tab.id
                ? `${tab.activeClass} shadow-sm`
                : `bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 ${tab.inactiveHover}`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 플랫폼별 콘텐츠 */}
      {platform === 'youtube' && <YouTubeSection addToast={addToast} />}
      {platform === 'naver' && <NaverBlogSection />}
      {platform === 'tistory' && <TistorySection />}
      {platform === 'rss' && <RssSection />}
    </div>
  )
}
