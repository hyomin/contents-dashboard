'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'
import {
  GUIDE_BY_CATEGORY,
  type GuideCategory,
  type AiScriptGuideRequestContext,
} from '@/lib/dashboard/content-creation-guide'
import type { ScriptGuideOutput } from '@/lib/dashboard/script-guide-output'
import type { ContentPolishResult } from '@/lib/dashboard/content-polish'
import { FORMAT_META } from '@/components/dashboard/views/ContentStudioView'
import {
  categoryToDefaultFormat,
  categoryToDefaultPlatform,
  saveContentStudioImport,
} from '@/lib/dashboard/content-studio-import'
import { getPlatformName, formatViews } from '@/lib/dashboard/dashboard-helpers'
import type { RssTopicCandidateRow } from '@/lib/data/rss-topic-collect'
import type { TrendingTopic, RssTrendingResponse, CategoryStat } from '@/app/api/dashboard/rss-trending/route'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import { PageLoadingOverlay, Spinner } from '@/components/dashboard/ui/loading'
import { GuideReferencePickerModal } from '@/components/dashboard/GuideReferencePickerModal'
import {
  loadGuideReferences,
  saveGuideReferences,
  rssTopicToGuideReference,
  trendingTopicToGuideReference,
  planningItemToGuideReference,
  type GuideReference,
} from '@/lib/dashboard/guide-references'
import {
  loadPublishTopic,
  savePublishTopic,
  parsePublishKeywords,
} from '@/lib/dashboard/guide-publish-topic'
import { usePlanningQueue, SOURCE_LABELS } from '@/lib/hooks/use-planning-queue'
import {
  draftToScriptOutput,
  useGenerationHistory,
  type GenerationHistoryItem,
} from '@/lib/hooks/use-generation-history'
import { ContentGenerationHistorySection } from '@/components/dashboard/ContentGenerationHistorySection'

/** 체널 카테고리 = RSS 카테고리와 동일 */
const CATEGORY_TABS = [
  { id: 'all', label: '전체', emoji: '🌐' },
  { id: '뉴스·시사', label: '뉴스·시사', emoji: '📰' },
  { id: '경제', label: '경제', emoji: '💰' },
  { id: 'IT·테크', label: 'IT·테크', emoji: '💻' },
  { id: '게임', label: '게임', emoji: '🎮' },
  { id: '육아', label: '육아', emoji: '👶' },
  { id: '교육', label: '교육', emoji: '📚' },
  { id: '엔터', label: '엔터', emoji: '🎭' },
  { id: '라이프', label: '라이프', emoji: '🏠' },
  { id: '부동산', label: '부동산', emoji: '🏢' },
  { id: '건강·의료', label: '건강·의료', emoji: '🏥' },
  { id: '복지·정책', label: '복지·정책', emoji: '📋' },
] as const

/** 카테고리별 뱃지 색상 (체널 카테고리 기준) */
const FEED_CATEGORY_COLORS: Record<string, string> = {
  '뉴스·시사':  'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
  '경제':       'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  'IT·테크':    'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
  '게임':       'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
  '육아':       'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
  '교육':       'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  '엔터':       'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
  '라이프':     'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
  '부동산':     'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  '건강·의료':  'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  '복지·정책':  'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
}

function FeedBadge({ name, categoryMap }: { name: string; categoryMap: Map<string, string> }) {
  const cat = categoryMap.get(name) ?? '기타'
  const color = FEED_CATEGORY_COLORS[cat] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>
      {name}
    </span>
  )
}

const CATEGORIES: { id: GuideCategory; label: string; icon: string }[] = [
  { id: 'writing', label: '글쓰기', icon: '📝' },
  { id: 'image', label: '이미지', icon: '🖼️' },
  { id: 'video', label: '영상', icon: '🎬' },
]

function mapCategoryToIntent(c: GuideCategory): AiScriptGuideRequestContext['intent'] {
  if (c === 'writing') return 'blog'
  if (c === 'image') return 'carousel'
  return 'longform_video'
}

export default function ContentCreationGuideView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [category, setCategory] = useState<GuideCategory>('writing')
  const [publishTopic, setPublishTopic] = useState('')
  const [publishTopicLoaded, setPublishTopicLoaded] = useState(false)
  const [references, setReferences] = useState<GuideReference[]>([])
  const [refsLoaded, setRefsLoaded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [rssTopics, setRssTopics] = useState<RssTopicCandidateRow[]>([])
  const [hiddenRssIds, setHiddenRssIds] = useState<Set<string | number>>(new Set())
  const [rssLoading, setRssLoading] = useState(false)
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeyword[]>([])
  const [scriptResult, setScriptResult] = useState<ScriptGuideOutput | null>(null)
  const [scriptLoading, setScriptLoading] = useState(false)
  const [polishedResult, setPolishedResult] = useState<ContentPolishResult | null>(null)
  const [polishLoading, setPolishLoading] = useState(false)
  const [resultView, setResultView] = useState<'draft' | 'polished'>('draft')
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const { items: queueItems, markUsed, removeItem: removeFromQueue } = usePlanningQueue()
  const {
    items: historyItems,
    isLoading: historyLoading,
    addFromGeneration,
    attachPolished,
    removeItem: removeHistoryItem,
    clearAll: clearHistory,
  } = useGenerationHistory()
  const pendingQueue = queueItems.filter((q) => !q.used)

  // 급상승 주제
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [allTopics, setAllTopics] = useState<TrendingTopic[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [feedCategoryMap, setFeedCategoryMap] = useState<Map<string, string>>(new Map())
  const [totalFeeds, setTotalFeeds] = useState(0)
  const [trendingTab, setTrendingTab] = useState<'trending' | 'all'>('trending')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const loadTrending = useCallback((cat?: string) => {
    setTrendingLoading(true)
    const catParam = cat && cat !== 'all' ? `&category=${encodeURIComponent(cat)}` : ''
    fetch(`/api/dashboard/rss-trending?days=7&limit=100${catParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: RssTrendingResponse) => {
        setTrendingTopics(d.trending ?? [])
        setAllTopics(d.allTopics ?? [])
        setCategoryStats(d.categoryStats ?? [])
        setTotalFeeds(d.totalFeeds ?? 0)
        const map = new Map<string, string>()
        for (const { category: c, feeds } of d.feedCategories ?? []) {
          for (const f of feeds) map.set(f, c)
        }
        setFeedCategoryMap(map)
      })
      .catch(() => {})
      .finally(() => setTrendingLoading(false))
  }, [])

  const loadRssTopics = useCallback(() => {
    setRssLoading(true)
    fetch('/api/dashboard/rss-topics?limit=20')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { topics?: RssTopicCandidateRow[] }) => setRssTopics(d.topics ?? []))
      .catch(() => setRssTopics([]))
      .finally(() => setRssLoading(false))
  }, [])

  useEffect(() => {
    setReferences(loadGuideReferences())
    setRefsLoaded(true)
    const fromUrl = searchParams.get('topic')?.trim()
    setPublishTopic(fromUrl || loadPublishTopic())
    setPublishTopicLoaded(true)
  }, [searchParams])

  const persistReferences = useCallback((next: GuideReference[]) => {
    setReferences(next)
    saveGuideReferences(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadRssTopics()
    loadTrending('all')
    fetch('/api/dashboard/trending?limit=10')
      .then((r) => r.json())
      .then((d: { keywords?: TrendingKeyword[] }) => {
        if (!cancelled) setTrendingKeywords(d.keywords ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loadRssTopics, loadTrending])

  const addReference = (ref: GuideReference) => {
    persistReferences([...references, ref])
    addToast('레퍼런스가 추가되었습니다', 'success')
  }

  const addTrendingAsReference = (t: TrendingTopic) => {
    addReference(trendingTopicToGuideReference(t))
  }

  const addRssAsReference = (t: RssTopicCandidateRow) => {
    addReference(rssTopicToGuideReference(t))
  }

  const persistPublishTopic = useCallback((next: string) => {
    setPublishTopic(next)
    savePublishTopic(next)
  }, [])

  const appendToPublishTopic = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim()
      if (!trimmed) return
      const current = publishTopic.trim()
      if (current.includes(trimmed)) {
        addToast(`"${trimmed}"는 이미 주제에 포함되어 있습니다`, 'info')
        return
      }
      const next = current ? `${current}, ${trimmed}` : trimmed
      persistPublishTopic(next)
      addToast(`발행 주제에 "${trimmed}" 추가됨`, 'success')
    },
    [publishTopic, persistPublishTopic, addToast],
  )

  const addFromPlanningQueueAsTopic = (item: (typeof queueItems)[number]) => {
    const text = (item.detail ?? item.keyword).trim()
    persistPublishTopic(text)
    addToast('기획 큐 항목을 발행 주제로 설정했습니다', 'success')
  }

  const addFromPlanningQueue = (item: (typeof queueItems)[number]) => {
    const ref = planningItemToGuideReference(item)
    persistReferences([...references, ref])
    markUsed(item.id)
    addToast('기획 큐 항목을 참고 레퍼런스에 연결했습니다', 'success')
  }

  const generateScriptGuide = async () => {
    if (!publishTopic.trim()) {
      addToast('발행하고 싶은 주제·키워드를 입력해 주세요', 'warning')
      return
    }
    setScriptLoading(true)
    setScriptResult(null)
    setPolishedResult(null)
    setResultView('draft')
    try {
      const res = await fetch('/api/dashboard/script-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: guideContext }),
      })
      const data = await res.json() as ScriptGuideOutput & { error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? '스크립트 생성 실패', 'warning')
      } else {
        setScriptResult(data)
        const historyId = await addFromGeneration({
          result: data,
          publishTopic: publishTopic.trim(),
          category,
          referenceTitles: references.map((r) => r.title),
        })
        if (historyId) setActiveHistoryId(historyId)
        addToast(
          historyId
            ? data.mode === 'n8n'
              ? 'n8n Gemini로 스크립트 생성 완료 · Supabase에 저장 🎬'
              : '스크립트 생성 완료 · Supabase에 저장 ✨'
            : data.mode === 'n8n'
              ? 'n8n Gemini로 스크립트 생성 완료 (히스토리 저장 실패) 🎬'
              : '스크립트 생성 완료 (히스토리 저장 실패) ✨',
          historyId ? 'success' : 'warning',
        )
      }
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setScriptLoading(false)
    }
  }

  const polishMyContent = async () => {
    if (!scriptResult) return
    setPolishLoading(true)
    try {
      const res = await fetch('/api/dashboard/content-polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scriptResult.title,
          fullScript: scriptResult.fullScript,
          category,
          targetFormat: scriptResult.targetFormat,
          userTopic: publishTopic.trim(),
          referenceTitles: references.map((r) => r.title),
        }),
      })
      const data = (await res.json()) as ContentPolishResult & { error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? '내 콘텐츠화 실패', 'warning')
        return
      }
      setPolishedResult(data)
      setResultView('polished')
      if (activeHistoryId) await attachPolished(activeHistoryId, data)
      addToast(
        category === 'writing'
          ? `발행용 본문 정재 완료 · 히스토리 업데이트 · 이미지 가이드 ${data.imageGuideCount}개 ✨`
          : '발행용 콘텐츠로 정재 완료 · 히스토리 업데이트 ✨',
        'success',
      )
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setPolishLoading(false)
    }
  }

  const goToContentStudioFromHistory = (item: GenerationHistoryItem, usePolished: boolean) => {
    const draft = item.draft
    const polished = item.polished
    const platform =
      draft.platform && draft.platform !== 'topic' && draft.platform !== 'insight'
        ? draft.platform
        : categoryToDefaultPlatform(item.category)
    const format = draft.targetFormat ?? categoryToDefaultFormat(item.category)
    saveContentStudioImport({
      platform,
      format,
      title: usePolished && polished ? polished.title : draft.title,
      body: usePolished && polished ? polished.fullContent : draft.fullScript,
      notes: [
        usePolished && polished ? '히스토리 · 내 콘텐츠화' : `히스토리 · ${draft.mode === 'n8n' ? 'n8n Gemini' : '대시보드 AI'}`,
        item.publishTopic ? `주제: ${item.publishTopic}` : draft.topic ? `주제: ${draft.topic}` : '',
        usePolished && polished?.summary ? polished.summary : '',
        draft.seoKeywords?.length ? `키워드: ${draft.seoKeywords.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-studio')
    router.push(`${pathname}?${p.toString()}`)
    addToast('콘텐츠 제작 화면으로 이동합니다', 'success')
  }

  const loadFromHistory = (item: GenerationHistoryItem, view: 'draft' | 'polished', silent = false) => {
    setCategory(item.category)
    persistPublishTopic(item.publishTopic)
    setScriptResult(draftToScriptOutput(item.draft, item.category))
    setPolishedResult(item.polished ? {
      title: item.polished.title,
      fullContent: item.polished.fullContent,
      summary: item.polished.summary,
      imageGuideCount: item.polished.imageGuideCount,
      polishedAt: item.polished.polishedAt,
    } : null)
    setResultView(view === 'polished' && item.polished ? 'polished' : 'draft')
    setActiveHistoryId(item.id)
    if (!silent) addToast('히스토리 항목을 불러왔습니다', 'success')
  }

  const loadedHistoryFromUrl = useRef<string | null>(null)
  useEffect(() => {
    const historyId = searchParams.get('historyId')
    if (!historyId || historyLoading) return
    if (loadedHistoryFromUrl.current === historyId) return
    const item = historyItems.find((x) => x.id === historyId)
    if (!item) return
    loadedHistoryFromUrl.current = historyId
    const view =
      searchParams.get('historyView') === 'polished' && item.polished ? 'polished' : 'draft'
    loadFromHistory(item, view, true)
  }, [searchParams, historyItems, historyLoading])

  const goToContentStudio = () => {
    if (!scriptResult) return
    const usePolished = polishedResult && resultView === 'polished'
    const platform =
      references.find((r) => r.platform && r.platform !== 'topic' && r.platform !== 'insight')?.platform ??
      scriptResult.platform ??
      categoryToDefaultPlatform(category)
    const format = scriptResult.targetFormat ?? categoryToDefaultFormat(category)
    saveContentStudioImport({
      platform,
      format,
      title: usePolished ? polishedResult!.title : scriptResult.title,
      body: usePolished ? polishedResult!.fullContent : scriptResult.fullScript,
      notes: [
        usePolished ? '내 콘텐츠화 · Gemini 정재' : `가이드 생성 · ${scriptResult.mode === 'n8n' ? 'n8n Gemini' : '대시보드 AI'}`,
        scriptResult.topic ? `주제: ${scriptResult.topic}` : '',
        usePolished && polishedResult!.summary ? polishedResult!.summary : '',
        scriptResult.seoKeywords?.length ? `키워드: ${scriptResult.seoKeywords.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    })
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-studio')
    router.push(`${pathname}?${p.toString()}`)
    addToast('콘텐츠 제작 화면으로 이동합니다', 'success')
  }

  const clearReferences = () => {
    persistReferences([])
    addToast('레퍼런스를 모두 비웠습니다', 'info')
  }

  const removeReference = (index: number) => {
    persistReferences(references.filter((_, i) => i !== index))
    addToast('레퍼런스가 제거되었습니다', 'info')
  }

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const guide = GUIDE_BY_CATEGORY[category]

  const guideContext = useMemo(
    (): AiScriptGuideRequestContext => ({
      category,
      userTopic: publishTopic.trim(),
      keywords: parsePublishKeywords(publishTopic),
      referenceTitles: references.map((r) => r.title),
      references: references.map((r) => ({
        title: r.title,
        platform: r.platform,
        channel: r.channel,
        vsAvg: r.vsAvg,
      })),
      intent: mapCategoryToIntent(category),
    }),
    [category, publishTopic, references],
  )

  const canGenerate = publishTopic.trim().length >= 2

  const displayTopics = trendingTab === 'trending' ? trendingTopics : allTopics

  const isPageLoading = rssLoading && rssTopics.length === 0

  return (
    <PageLoadingOverlay loading={isPageLoading} label="콘텐츠 가이드 데이터를 불러오는 중…">
    <div className="space-y-8 max-w-4xl">
      <N8nLv1ServicesSection viewId="content-guide" addToast={addToast} />

      {/* ── 발행 주제 (필수) ─────────────────────────────────────── */}
      <section className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-gray-900 p-6 space-y-4 shadow-sm">
        <TitleWithHint
          as="h3"
          className="text-base font-bold text-indigo-900 dark:text-indigo-100"
          hint="이번에 발행할 콘텐츠의 핵심 주제입니다. AI는 이 키워드를 최우선으로 글·스크립트를 작성합니다. 아래 레퍼런스는 선택 사항이며, 구조·톤 참고용입니다."
        >
          ✍️ 발행하고 싶은 주제 · 키워드
          <span className="ml-2 text-xs font-normal text-red-500 dark:text-red-400">필수</span>
        </TitleWithHint>
        <textarea
          value={publishTopic}
          onChange={(e) => persistPublishTopic(e.target.value)}
          placeholder={'예: 삼성전자 단기 전망\n하이닉스 1주일 전망\n(쉼표·줄바꿈으로 여러 키워드 입력 가능)'}
          rows={3}
          className="w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[88px]"
        />
        {publishTopicLoaded && publishTopic.trim() && (
          <div className="flex flex-wrap gap-1.5">
            {parsePublishKeywords(publishTopic).map((kw) => (
              <span
                key={kw}
                className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 font-medium"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}
        {trendingKeywords.length > 0 && (
          <div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mb-2">트렌딩 키워드 — 클릭하면 발행 주제에 추가</p>
            <div className="flex flex-wrap gap-2">
              {trendingKeywords.slice(0, 6).map((kw) => (
                <button
                  key={kw.rank}
                  type="button"
                  onClick={() => appendToPublishTopic(kw.keyword)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-800 dark:text-gray-100 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                >
                  <span className="font-semibold">+ {kw.keyword}</span>
                  <span className="ml-1.5 text-indigo-600 dark:text-indigo-300 tabular-nums">{kw.rank}위</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 급상승 주제 ───────────────────────────────────────────── */}
      <section className="rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <TitleWithHint
            as="h3"
            className="text-sm font-bold text-rose-900 dark:text-rose-200"
            hint={`${totalFeeds}개 RSS 피드(뉴스·시사/경제/IT·테크/게임/육아/교육/엔터/라이프/부동산/건강 등)에서 2개 이상 피드가 동시에 다룬 주제를 급상승으로 표시합니다. 피드 뱃지 배열로 어느 소스에서 거론됐는지 확인하세요.`}
          >
            🔥 급상승 주제
            {totalFeeds > 0 && (
              <span className="ml-2 text-xs font-normal text-rose-600 dark:text-rose-400">
                ({totalFeeds}개 피드 구독 중)
              </span>
            )}
          </TitleWithHint>
          <button
            type="button"
            onClick={() => loadTrending(categoryFilter)}
            disabled={trendingLoading}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {trendingLoading ? '로딩 중…' : '↻ 새로고침'}
          </button>
        </div>

        {/* 카테고리 필터 탭 (가로 스크롤) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const stat = categoryStats.find((s) => s.category === tab.id)
            const count = tab.id === 'all'
              ? allTopics.length
              : (stat?.count ?? 0)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(tab.id)
                  loadTrending(tab.id)
                }}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                  categoryFilter === tab.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-rose-300'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`rounded-full px-1 text-[10px] font-bold ${categoryFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 탭: 급상승 / 전체 */}
        <div className="flex gap-2">
          {(['trending', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTrendingTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                trendingTab === tab
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-rose-300'
              }`}
            >
              {tab === 'trending'
                ? `🔥 급상승 ${trendingTopics.length > 0 ? `(${trendingTopics.length})` : ''}`
                : `전체 주제 ${allTopics.length > 0 ? `(${allTopics.length})` : ''}`}
            </button>
          ))}
        </div>

        {trendingLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-white/60 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : displayTopics.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            {trendingTab === 'trending'
              ? '아직 급상승 주제가 없습니다. 상단 n8n 자동화에서 RSS 주제를 수집하면 여기 표시됩니다.'
              : '수집된 주제가 없습니다. n8n «RSS 주제 수집» 또는 «주제 선별 AI»를 실행하세요.'}
          </div>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {displayTopics.map((t, idx) => (
              <li key={`${t.id}-${idx}`}>
                <button
                  type="button"
                  onClick={() => addTrendingAsReference(t)}
                  title="클릭하면 참고 레퍼런스에 추가"
                  className="w-full text-left rounded-xl bg-white/90 dark:bg-gray-900/60 border border-rose-100 dark:border-rose-900/50 px-3 py-2.5 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition cursor-pointer"
                >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                      {t.ai_title ?? t.title}
                    </p>
                    {t.ai_reason && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {t.ai_reason}
                      </p>
                    )}
                  </div>
                  {t.isTrending && (
                    <span className="shrink-0 text-[10px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5">
                      🔥 {t.sourceCount}곳
                    </span>
                  )}
                </div>

                {/* 카테고리 배지 */}
                {t.categories && t.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.categories.map((cat) => {
                      const color = FEED_CATEGORY_COLORS[cat] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                      const tabInfo = CATEGORY_TABS.find((tb) => tb.id === cat)
                      return (
                        <span key={cat} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>
                          {tabInfo?.emoji} {cat}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* 소스(피드) 배열 뱃지 */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {t.sources.map((src) => (
                    <FeedBadge key={src} name={src} categoryMap={feedCategoryMap} />
                  ))}
                  {t.link && (
                    <a
                      href={t.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      원문 ↗
                    </a>
                  )}
                </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/25 p-5 space-y-4">
        <TitleWithHint
          as="h3"
          className="text-sm font-bold text-emerald-900 dark:text-emerald-200"
          hint="n8n «RSS → 주제 후보 자동 수집» 또는 «주제 선별 AI»에서 저장된 주제입니다. 카드를 클릭하면 참고 레퍼런스에 추가됩니다."
        >
          RSS 주제 후보
        </TitleWithHint>
        <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
          수집은 상단 n8n 자동화 또는 주제 선별 화면에서 실행합니다. 여기서는 저장된 후보만 조회·레퍼런스로 연결합니다.
        </p>
        {rssLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/60 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : rssTopics.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            저장된 주제가 없습니다. n8n «RSS 주제 수집» 또는 «주제 선별 AI»를 먼저 실행하세요.
          </p>
        ) : (
          <>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {rssTopics
                .filter((t) => !hiddenRssIds.has(t.id))
                .map((t, idx) => (
                  <li key={`${t.id}-${idx}`} className="group relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setHiddenRssIds((prev) => new Set([...prev, t.id]))
                      }}
                      title="이 주제 숨기기"
                      className="absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full
                        text-gray-300 dark:text-gray-600
                        hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400
                        opacity-0 group-hover:opacity-100 transition text-xs font-bold"
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      onClick={() => addRssAsReference(t)}
                      title="클릭하면 참고 레퍼런스에 추가"
                      className="w-full text-left rounded-xl bg-white/80 dark:bg-gray-900/60 border border-emerald-100 dark:border-emerald-900 px-3 py-2.5 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition"
                    >
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 pr-5">{t.title}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-500">
                      <span>{t.source_feed}</span>
                      <span className="text-emerald-600 font-semibold">점수 {Number(t.relevance_score)}</span>
                      {t.link && (
                        <a
                          href={t.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline"
                        >
                          원문
                        </a>
                      )}
                    </div>
                    </button>
                  </li>
                ))}
            </ul>
            {hiddenRssIds.size > 0 && (
              <button
                type="button"
                onClick={() => setHiddenRssIds(new Set())}
                className="text-xs text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
              >
                숨긴 항목 {hiddenRssIds.size}개 다시 표시
              </button>
            )}
          </>
        )}
      </section>

      {/* ── 참고 레퍼런스 (독립 섹션) ─────────────────────────────── */}
      <section className="rounded-2xl border-2 border-violet-300 dark:border-violet-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-violet-100 dark:border-violet-900/50 bg-gradient-to-r from-violet-600 to-indigo-600">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <TitleWithHint
              as="h3"
              className="text-base font-bold text-white"
              hintVariant="light"
              hint="급상승·RSS·AI 인사이트·채널 콘텐츠를 선택하면 제목·H2 구조·톤만 벤치마킹합니다. 없어도 발행 주제만으로 생성 가능합니다."
            >
              📎 참고 레퍼런스
              <span className="ml-2 text-xs font-normal text-white/60">선택</span>
              {references.length > 0 && (
                <span className="ml-2 text-xs font-normal text-white/70">({references.length}개)</span>
              )}
            </TitleWithHint>
            <div className="flex items-center gap-1.5 shrink-0">
              {references.length > 0 && (
                <button
                  type="button"
                  onClick={clearReferences}
                  className="px-2.5 py-1 text-xs text-white/80 hover:text-white border border-white/30 rounded-lg hover:bg-white/10 transition"
                >
                  전체 삭제
                </button>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-violet-700 hover:bg-violet-50 transition"
              >
                + 채널 콘텐츠
              </button>
            </div>
          </div>
          <p className="text-xs text-white/70 mt-1">
            위 급상승·RSS 카드 클릭, 기획 큐 연결, 또는 채널 콘텐츠 선택으로 레퍼런스를 추가할 수 있습니다.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* 기획 큐 → 레퍼런스 연결 */}
          {pendingQueue.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  📋 기획 큐
                  <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded-full px-2 py-0.5 text-[10px]">
                    {pendingQueue.length}
                  </span>
                </p>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                  «주제» = 발행 키워드 · «+ 레퍼런스» = 구조 참고용
                </p>
              </div>
              <ul className="space-y-2">
                {pendingQueue.map((item) => {
                  const src = SOURCE_LABELS[item.source]
                  return (
                    <li key={item.id}>
                      <div className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => addFromPlanningQueueAsTopic(item)}
                          title="발행 주제로 설정"
                          className="shrink-0 px-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-100/80 dark:bg-amber-900/40 text-[10px] font-bold text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition"
                        >
                          주제
                        </button>
                        <button
                          type="button"
                          onClick={() => addFromPlanningQueue(item)}
                          className="flex-1 min-w-0 text-left rounded-xl bg-white dark:bg-gray-900/60 border border-amber-200 dark:border-amber-800 px-3 py-2.5 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition group"
                        >
                          <div className="flex items-start gap-2">
                            {item.icon && <span className="text-lg shrink-0">{item.icon}</span>}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white line-clamp-2 group-hover:text-violet-800 dark:group-hover:text-violet-200">
                                {item.detail ?? item.keyword}
                              </p>
                              <span className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded font-semibold ${src.color}`}>
                                {src.label}
                              </span>
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromQueue(item.id)}
                          title="기획 큐에서 제거"
                          className="shrink-0 px-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition text-sm"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* 레퍼런스 목록 */}
          {!refsLoaded ? (
            <div className="py-8 text-center text-sm text-gray-400">불러오는 중…</div>
          ) : references.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
              <p className="text-2xl mb-2">📎</p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">레퍼런스 없이도 생성 가능</p>
              <p className="text-xs text-gray-400 mb-4 max-w-sm mx-auto">
                발행 주제만 입력해도 AI가 초안을 만듭니다. 급상승·RSS·채널 콘텐츠를 추가하면 구조·톤을 참고합니다.
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition"
              >
                플랫폼 · 채널 · 콘텐츠 선택
              </button>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {references.map((ref, i) => (
                <li
                  key={`${i}-${ref.id}`}
                  className="group rounded-xl border border-gray-100 dark:border-gray-600 p-3 hover:border-violet-200 dark:hover:border-violet-800 transition relative bg-gray-50/50 dark:bg-gray-900/30"
                >
                  <button
                    type="button"
                    onClick={() => removeReference(i)}
                    title="레퍼런스 제거"
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full
                      text-gray-300 dark:text-gray-600
                      hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400
                      opacity-0 group-hover:opacity-100 transition text-xs font-bold"
                  >
                    ×
                  </button>

                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-3 pr-5">
                    {ref.url ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {ref.title}
                      </a>
                    ) : (
                      ref.title
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-gray-500">
                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px]">
                      {ref.platform === 'topic'
                        ? '주제'
                        : ref.platform === 'insight'
                          ? '인사이트'
                          : getPlatformName(ref.platform)}
                    </span>
                    {ref.sourceType === 'insight' && (
                      <span className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-semibold">
                        AI 인사이트
                      </span>
                    )}
                    {ref.sourceType === 'trending' && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] font-semibold">
                        급상승
                      </span>
                    )}
                    {ref.sourceType === 'rss' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                        RSS
                      </span>
                    )}
                    {ref.sourceType === 'content' && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                        콘텐츠
                      </span>
                    )}
                    {ref.tier && (
                      <span className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-[10px]">
                        {ref.tier}
                      </span>
                    )}
                    {ref.vsAvg != null && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">vs.Avg {ref.vsAvg}x</span>
                    )}
                    {ref.views != null && (
                      <span className="text-[10px]">{formatViews(ref.views)} 조회</span>
                    )}
                    {ref.channel && ref.sourceType !== 'insight' && (
                      <span className="text-gray-400 truncate max-w-[8rem] text-[10px]">{ref.channel}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={generateScriptGuide}
            disabled={scriptLoading || !canGenerate}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition ${
              scriptLoading || !canGenerate
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md'
            }`}
          >
            {scriptLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" color="border-white" />
                n8n Gemini 스크립트 생성 중…
              </span>
            ) : (
              `✨ 스크립트 가이드 생성${references.length > 0 ? ` · 레퍼런스 ${references.length}개 참고` : ''}`
            )}
          </button>
          <p className="text-[10px] text-center text-gray-400 -mt-2">
            {canGenerate
              ? `주제: «${publishTopic.trim().slice(0, 40)}${publishTopic.trim().length > 40 ? '…' : ''}» · n8n «롱폼 스크립트» · ${CATEGORIES.find((c) => c.id === category)?.label} 가이드`
              : '위 «발행 주제»를 입력하면 생성할 수 있습니다'}
          </p>
        </div>
      </section>

      {/* ── 포맷별 가이드 ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">포맷별 제작 가이드</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
                  ${
                    category === c.id
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-violet-300'
                  }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {CATEGORIES.find((c) => c.id === category)?.icon} {guide.title} 가이드
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{guide.intro}</p>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">체크리스트</p>
              {checkedItems.size > 0 && (
                <button
                  type="button"
                  onClick={() => setCheckedItems(new Set())}
                  className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  초기화
                </button>
              )}
            </div>
            <ul className="space-y-1.5">
              {guide.checklist.map((item, i) => {
                const done = checkedItems.has(i)
                return (
                  <li
                    key={i}
                    onClick={() => toggleCheck(i)}
                    className={`flex gap-2 cursor-pointer rounded-lg px-2 py-1.5 transition select-none
                      ${done
                        ? 'bg-violet-50 dark:bg-violet-950/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                  >
                    <span className={`shrink-0 mt-0.5 ${done ? 'text-violet-500' : 'text-gray-300 dark:text-gray-600'}`}>
                      {done ? '☑' : '☐'}
                    </span>
                    <span className={`text-sm ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                      {item}
                    </span>
                  </li>
                )
              })}
            </ul>
            {checkedItems.size > 0 && (
              <p className="mt-2 text-xs text-violet-600 dark:text-violet-400 text-right">
                {checkedItems.size}/{guide.checklist.length} 완료
              </p>
            )}
          </div>
          {guide.sections.map((sec, i) => (
            <div key={i} className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">{sec.heading}</p>
              <ul className="space-y-1.5">
                {sec.bullets.map((b, j) => (
                  <li key={j} className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-sm italic text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/30 rounded-xl p-3">
            💡 {guide.closingTip}
          </p>
        </div>
      </section>

      {/* ── 생성 결과 ───────────────────────────────────────────── */}
      <section className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-6 space-y-4">
        <TitleWithHint
          as="h3"
          className="text-lg font-bold text-indigo-900 dark:text-indigo-200"
          hint="스크립트 가이드 생성 후 «내 콘텐츠화»로 레퍼런스 흔적을 제거·발행용 정재할 수 있습니다. 블로그는 환기용 이미지·표 가이드 블록이 본문에 포함됩니다(이미지 자동 생성 없음)."
        >
          생성 결과
        </TitleWithHint>

        {!scriptResult && !scriptLoading && (
          <p className="text-sm text-gray-500 text-center py-8">
            발행 주제를 입력한 뒤 «스크립트 가이드 생성»을 누르면 결과가 여기 표시되고 히스토리에 자동 저장됩니다.
          </p>
        )}

        {scriptLoading && (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-indigo-600 dark:text-indigo-400">
            <Spinner size="md" />
            n8n Gemini Agent가 레퍼런스를 반영해 스크립트를 작성 중…
          </div>
        )}

        {scriptResult && !scriptLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  {resultView === 'polished' && polishedResult ? polishedResult.title : scriptResult.title}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {resultView === 'polished' && polishedResult
                    ? `내 콘텐츠화 · Gemini · ${new Date(polishedResult.polishedAt).toLocaleString('ko-KR')}`
                    : `${scriptResult.mode === 'n8n' ? 'n8n Gemini' : '대시보드 AI'} · ${FORMAT_META[scriptResult.targetFormat]?.label ?? scriptResult.targetFormat} · ${getPlatformName(scriptResult.platform)} · ${new Date(scriptResult.generatedAt).toLocaleString('ko-KR')}`}
                </p>
                {resultView === 'polished' && polishedResult?.summary && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">{polishedResult.summary}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={polishMyContent}
                  disabled={polishLoading}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {polishLoading ? '정재 중…' : '✨ 내 콘텐츠화'}
                </button>
                <button
                  type="button"
                  onClick={goToContentStudio}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition"
                >
                  콘텐츠 제작 →
                </button>
              </div>
            </div>

            {polishedResult && (
              <div className="flex gap-2 p-1 bg-white/60 dark:bg-gray-900/40 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setResultView('draft')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    resultView === 'draft'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  가이드 초안
                </button>
                <button
                  type="button"
                  onClick={() => setResultView('polished')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    resultView === 'polished'
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  내 콘텐츠 {polishedResult.imageGuideCount > 0 ? `(📷 ${polishedResult.imageGuideCount})` : ''}
                </button>
              </div>
            )}

            {polishLoading && (
              <div className="py-8 flex flex-col items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <Spinner size="md" />
                Gemini가 레퍼런스 흔적을 제거하고 발행용 본문으로 정재 중…
                {category === 'writing' && (
                  <p className="text-xs text-gray-500">블로그: 환기용 이미지·표 가이드 블록을 본문에 배치합니다</p>
                )}
              </div>
            )}

            {resultView === 'draft' && !polishLoading && (
              <>
                {scriptResult.hook && (
                  <div className="rounded-xl bg-white/80 dark:bg-gray-900/60 border border-indigo-100 dark:border-indigo-900 p-4">
                    <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-1">오프닝 훅</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{scriptResult.hook}</p>
                  </div>
                )}

                {scriptResult.chapterSummary && scriptResult.chapterSummary.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {scriptResult.chapterSummary.map((c, i) => (
                      <li
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900 text-gray-700 dark:text-gray-300"
                      >
                        {i + 1}. {c}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {!polishLoading && (
              <div className="rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 overflow-hidden">
                <div className="px-4 py-2 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                    {resultView === 'polished' && polishedResult ? '발행용 본문 (이미지·표 가이드 포함)' : '전체 스크립트'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const text =
                        resultView === 'polished' && polishedResult
                          ? polishedResult.fullContent
                          : scriptResult.fullScript
                      void navigator.clipboard.writeText(text)
                      addToast('복사되었습니다', 'success')
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    복사
                  </button>
                </div>
                <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed max-h-[520px] overflow-y-auto">
                  {resultView === 'polished' && polishedResult
                    ? polishedResult.fullContent
                    : scriptResult.fullScript}
                </pre>
              </div>
            )}

            {resultView === 'draft' && scriptResult.cta && !polishLoading && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">CTA:</span> {scriptResult.cta}
              </p>
            )}

            {resultView === 'polished' && polishedResult && category === 'writing' && !polishLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
                📷 본문의 «환기용 이미지 가이드»·«표 가이드» 블록은 직접 이미지·표를 제작해 넣을 위치 안내입니다. AI는 이미지를 생성하지 않습니다.
              </p>
            )}

            <button
              type="button"
              onClick={goToContentStudio}
              className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 text-white dark:text-gray-900 hover:opacity-90 transition"
            >
              {polishedResult && resultView === 'polished'
                ? '정재된 본문으로 콘텐츠 제작 →'
                : '이 스크립트로 콘텐츠 제작 →'}
            </button>
          </div>
        )}
      </section>

      <ContentGenerationHistorySection
        items={historyItems}
        activeId={activeHistoryId}
        isLoading={historyLoading}
        addToast={addToast}
        onLoad={loadFromHistory}
        onRemove={async (id) => {
          await removeHistoryItem(id)
          if (activeHistoryId === id) setActiveHistoryId(null)
        }}
        onClearAll={async () => {
          await clearHistory()
        }}
        onGoToStudio={goToContentStudioFromHistory}
      />
    </div>
    <GuideReferencePickerModal
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={addReference}
      addToast={addToast}
    />
    </PageLoadingOverlay>
  )
}
