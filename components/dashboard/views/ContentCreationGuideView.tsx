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
import {
  extractFlowScenePaste,
  extractGeminiFlowPasteSection,
  listFlowScenePastes,
} from '@/lib/dashboard/gemini-flow-paste'
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
import type { TopicKeywordGuideSuggestion, TopicKeywordGuideResult } from '@/lib/dashboard/topic-keyword-guide'
import { TopicGuideHistorySection } from '@/components/dashboard/TopicGuideHistorySection'
import { GuideAiModelSelect } from '@/components/dashboard/GuideAiModelSelect'
import { getGeminiModelLabel } from '@/lib/dashboard/gemini-models'
import {
  loadScriptGuideModel,
  loadTopicGuideModel,
  saveScriptGuideModel,
  saveTopicGuideModel,
} from '@/lib/dashboard/guide-ai-model-prefs'
import { useTopicGuideHistory } from '@/lib/hooks/use-topic-guide-history'
import type { TopicGuideHistoryItem } from '@/lib/dashboard/topic-guide-history-types'
import { ContentGenerationHistorySection } from '@/components/dashboard/ContentGenerationHistorySection'
import { GuideReferencesPanel } from '@/components/dashboard/GuideReferencesPanel'
import { guideRefToAi } from '@/lib/dashboard/guide-reference-modes'
import {
  ShortformCategorySelect,
} from '@/components/dashboard/ShortformCategorySelect'
import {
  BUILTIN_SHORTFORM_CATEGORIES,
  findShortformCategory,
  loadSelectedShortformCategoryId,
  saveSelectedShortformCategoryId,
} from '@/lib/dashboard/shortform-categories'

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
  { id: 'video', label: '영상', icon: '🎬' },
  { id: 'writing', label: '글쓰기', icon: '📝' },
  { id: 'image', label: '캐러셀', icon: '🖼️' },
]

type VideoMode = 'shortform' | 'longform'

const VIDEO_MODE_TABS: { id: VideoMode; label: string; icon: string; desc: string }[] = [
  { id: 'shortform', label: '숏폼', icon: '⚡', desc: '60초 이내 · YouTube Shorts / Reels' },
  { id: 'longform',  label: '롱폼', icon: '🎞️', desc: '8~12분 · YouTube 본영상' },
]

function mapCategoryToIntent(
  c: GuideCategory,
  videoMode: VideoMode,
): AiScriptGuideRequestContext['intent'] {
  if (c === 'writing') return 'blog'
  if (c === 'image') return 'carousel'
  return videoMode === 'longform' ? 'longform_video' : 'shortform_video'
}

export default function ContentCreationGuideView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [category, setCategory] = useState<GuideCategory>('video')
  const [videoMode, setVideoMode] = useState<VideoMode>('shortform')
  const [shortformCategoryId, setShortformCategoryId] = useState(
    () => BUILTIN_SHORTFORM_CATEGORIES[0].id,
  )
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
  const [refSourceTab, setRefSourceTab] = useState<'selected' | 'trending' | 'rss'>('selected')

  // 주제 키워드 가이드 (발행 주제 입력 전)
  const [seedKeyword, setSeedKeyword] = useState('')
  const [topicGuideSuggestions, setTopicGuideSuggestions] = useState<TopicKeywordGuideSuggestion[]>([])
  const [topicGuideLoading, setTopicGuideLoading] = useState(false)
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)
  const [activeTopicGuideHistoryId, setActiveTopicGuideHistoryId] = useState<string | null>(null)
  const {
    items: topicGuideHistoryItems,
    isLoading: topicGuideHistoryLoading,
    addFromGuide,
    attachSelection,
    removeItem: removeTopicGuideHistoryItem,
    clearAll: clearTopicGuideHistory,
  } = useTopicGuideHistory()

  const [topicGuideModel, setTopicGuideModel] = useState(loadTopicGuideModel)
  /** 마지막 주제 가이드 생성 시 사용한 숏폼 카테고리 (불일치 시 재생성 안내) */
  const [topicGuideForCategoryId, setTopicGuideForCategoryId] = useState<string | null>(null)
  const [scriptGuideModel, setScriptGuideModel] = useState(loadScriptGuideModel)

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

  useEffect(() => {
    setShortformCategoryId(loadSelectedShortformCategoryId())
  }, [])

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

  const applyGuideSuggestion = useCallback(
    (suggestion: TopicKeywordGuideSuggestion, historyId?: string | null) => {
      persistPublishTopic(suggestion.title)
      setSelectedGuideId(suggestion.id)
      const hid = historyId ?? activeTopicGuideHistoryId
      if (hid) void attachSelection(hid, suggestion, suggestion.title)
      const catLabel =
        category === 'video' ? findShortformCategory(shortformCategoryId)?.label : undefined
      const anglePreview = suggestion.angle
        ? suggestion.angle.length > 72
          ? `${suggestion.angle.slice(0, 72)}…`
          : suggestion.angle
        : ''
      addToast(
        catLabel && anglePreview
          ? `발행 주제 설정 · ${catLabel} — ${anglePreview}`
          : '발행 주제로 설정했습니다',
        'success',
      )
    },
    [
      persistPublishTopic,
      addToast,
      activeTopicGuideHistoryId,
      attachSelection,
      category,
      shortformCategoryId,
    ],
  )

  const handleShortformCategoryChange = useCallback(
    (id: string) => {
      if (
        category === 'video' &&
        topicGuideSuggestions.length > 0 &&
        topicGuideForCategoryId &&
        id !== topicGuideForCategoryId
      ) {
        setTopicGuideSuggestions([])
        setSelectedGuideId(null)
        setActiveTopicGuideHistoryId(null)
        addToast('숏폼 카테고리가 바뀌었습니다. 주제 가이드를 다시 생성해 주세요.', 'info')
      }
      setShortformCategoryId(id)
      saveSelectedShortformCategoryId(id)
    },
    [
      category,
      topicGuideSuggestions.length,
      topicGuideForCategoryId,
      addToast,
    ],
  )

  const restoreTopicGuideHistory = useCallback(
    (item: TopicGuideHistoryItem) => {
      setSeedKeyword(item.seedKeyword)
      setCategory(item.category)
      setTopicGuideSuggestions(item.suggestions)
      setActiveTopicGuideHistoryId(item.id)
      if (item.selectedSuggestion) {
        setSelectedGuideId(item.selectedSuggestion.id)
        persistPublishTopic(item.selectedPublishTopic ?? item.selectedSuggestion.title)
      } else {
        setSelectedGuideId(null)
      }
      addToast('주제 가이드 기록을 불러왔습니다', 'success')
    },
    [persistPublishTopic, addToast],
  )

  const fetchTopicKeywordGuide = async () => {
    if (seedKeyword.trim().length < 2) {
      addToast('주제 가이드 키워드를 2자 이상 입력해 주세요', 'warning')
      return
    }
    const modelLabel = getGeminiModelLabel(topicGuideModel)
    const sfLabel =
      category === 'video' ? findShortformCategory(shortformCategoryId)?.label : undefined
    const ok = window.confirm(
      `주제 가이드를 생성할까요?\n\n키워드: ${seedKeyword.trim()}${sfLabel ? `\n숏폼 카테고리: ${sfLabel}` : ''}\nAI 모델: ${modelLabel}\n\n제안마다 «angle»에 위 카테고리 장르(스토리 전개·톤)가 반영됩니다.\nGemini API가 호출됩니다 (약 10~30초).`,
    )
    if (!ok) return

    setTopicGuideLoading(true)
    setTopicGuideSuggestions([])
    setSelectedGuideId(null)
    setActiveTopicGuideHistoryId(null)
    try {
      const res = await fetch('/api/dashboard/topic-keyword-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seedKeyword: seedKeyword.trim(),
          category,
          shortformCategoryId: category === 'video' ? shortformCategoryId : undefined,
          aiModel: topicGuideModel,
        }),
      })
      const data = (await res.json()) as TopicKeywordGuideResult & { error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? '주제 가이드 생성 실패', 'warning')
        return
      }
      const suggestions = data.suggestions ?? []
      setTopicGuideSuggestions(suggestions)
      if (category === 'video') {
        setTopicGuideForCategoryId(shortformCategoryId)
      }
      if (suggestions.length === 0) {
        addToast('제안을 생성하지 못했습니다. 키워드를 바꿔 다시 시도해 주세요.', 'warning')
      } else {
        const historyId = await addFromGuide({
          seedKeyword: seedKeyword.trim(),
          category,
          suggestions,
          guideGeneratedAt: data.generatedAt,
        })
        if (historyId) {
          setActiveTopicGuideHistoryId(historyId)
          addToast(`주제 가이드 ${suggestions.length}개 · 기록 저장 ✨`, 'success')
        } else {
          addToast(`주제 가이드 ${suggestions.length}개 (기록 저장 실패)`, 'warning')
        }
      }
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setTopicGuideLoading(false)
    }
  }

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

  const generatePublishContent = async () => {
    if (!publishTopic.trim()) {
      addToast('발행하고 싶은 주제·키워드를 입력해 주세요', 'warning')
      return
    }
    const modelLabel = getGeminiModelLabel(scriptGuideModel)
    const topicPreview =
      publishTopic.trim().length > 60 ? `${publishTopic.trim().slice(0, 60)}…` : publishTopic.trim()
    const refLine =
      references.length > 0
        ? `레퍼런스 ${references.length}개 참고`
        : '레퍼런스 0 · 주제만으로 작성'
    const polishHint =
      category === 'writing'
        ? '\n · 발행용 블로그 + 이미지·표 가이드'
        : category === 'video' && videoMode === 'shortform'
          ? '\n · [0~N초] 장면별 대본 + 화면(한글) + Google Flow 프롬프트'
          : category === 'video' && videoMode === 'longform'
            ? '\n · 챕터별 완성 대본 + YouTube 설명란 타임스탬프'
            : ''
    const videoLabel =
      category === 'video'
        ? VIDEO_MODE_TABS.find((t) => t.id === videoMode)?.label ?? videoMode
        : CATEGORIES.find((c) => c.id === category)?.label ?? category
    const ok = window.confirm(
      `발행용 콘텐츠를 생성할까요?\n\n발행 주제: ${topicPreview}\nAI 모델: ${modelLabel}\n${refLine}\n포맷: ${videoLabel}${category === 'video' && videoMode === 'shortform' ? `\n숏폼 카테고리: ${findShortformCategory(shortformCategoryId)?.label ?? shortformCategoryId}` : ''}${polishHint}\n\n(n8n Gemini 1회 호출 · 가이드 초안 단계 없음)`,
    )
    if (!ok) return

    setScriptLoading(true)
    setScriptResult(null)
    setPolishedResult(null)
    try {
      const res = await fetch('/api/dashboard/script-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: guideContext }),
      })
      const data = (await res.json()) as ScriptGuideOutput & {
        polished?: ContentPolishResult
        error?: string
      }
      if (!res.ok || data.error) {
        addToast(data.error ?? '발행용 콘텐츠 생성 실패', 'warning')
      } else {
        const polished = data.polished ?? null
        const { polished: _p, ...script } = data
        setScriptResult(script)
        setPolishedResult(polished)
        const historyId = await addFromGeneration({
          result: script,
          publishTopic: publishTopic.trim(),
          category,
          referenceTitles: references.map((r) => r.title),
        })
        if (historyId) {
          setActiveHistoryId(historyId)
          if (polished) await attachPolished(historyId, polished)
        }
        const modeLabel =
          category === 'writing' ? '블로그'
          : category === 'video' && videoMode === 'longform' ? '롱폼'
          : category === 'video' ? '숏폼'
          : '캐러셀'
        addToast(
          historyId
            ? category === 'writing' && polished
              ? `발행용 콘텐츠 생성 · 저장 완료 · 이미지 가이드 ${polished.imageGuideCount}개 ✨`
              : `${modeLabel} 발행용 스크립트 생성 · 저장 완료 ✨`
            : '발행용 콘텐츠 생성 완료 (히스토리 저장 실패)',
          historyId ? 'success' : 'warning',
        )
      }
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setScriptLoading(false)
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
    addToast('발행 편집 화면으로 이동합니다 (선택)', 'success')
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
    const usePolished = !!polishedResult
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
        '발행용 콘텐츠 · Gemini',
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
    addToast('발행 편집 화면으로 이동합니다 (선택)', 'success')
  }

  const clearReferences = () => {
    persistReferences([])
    addToast('레퍼런스를 모두 비웠습니다', 'info')
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
      shortformCategoryId: category === 'video' && videoMode === 'shortform' ? shortformCategoryId : undefined,
      userTopic: publishTopic.trim(),
      keywords: parsePublishKeywords(publishTopic),
      referenceTitles: references.map((r) => r.title),
      references: references.map(guideRefToAi),
      intent: mapCategoryToIntent(category, videoMode),
      aiModel: scriptGuideModel,
    }),
    [category, videoMode, shortformCategoryId, publishTopic, references, scriptGuideModel],
  )

  const canGenerate = publishTopic.trim().length >= 2

  const displayTopics = trendingTab === 'trending' ? trendingTopics : allTopics

  const isPageLoading = rssLoading && rssTopics.length === 0

  return (
    <PageLoadingOverlay loading={isPageLoading} label="콘텐츠 가이드 데이터를 불러오는 중…">
    <div className="space-y-8 max-w-4xl">
      <N8nLv1ServicesSection viewId="content-guide" addToast={addToast} />

      {/* ── 포맷 탭 (숏폼 기본) ───────────────────────────────────── */}
      <section className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold text-gray-900 dark:text-white">제작 포맷</p>
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
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                  }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {category === 'video' && (
          <div className="mt-4 pt-4 border-t border-violet-100 dark:border-violet-900/50 space-y-4">
            {/* 숏폼 / 롱폼 서브 토글 */}
            <div className="flex flex-wrap gap-2">
              {VIDEO_MODE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVideoMode(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
                    ${
                      videoMode === tab.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                    }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                  <span className={`text-[10px] font-normal ${videoMode === tab.id ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {tab.desc}
                  </span>
                </button>
              ))}
            </div>
            {videoMode === 'shortform' && (
              <ShortformCategorySelect
                value={shortformCategoryId}
                onChange={handleShortformCategoryChange}
              />
            )}
            {videoMode === 'longform' && (
              <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 py-2">
                🎞️ <strong>롱폼 모드:</strong> 8~12분 분량 · 챕터별 대본 + YouTube 설명란용 타임스탬프 자동 생성
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── 1. 주제 키워드 가이드 (발행 주제 입력 전) ─────────────── */}
      <section className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 p-6 space-y-4 shadow-sm">
        <TitleWithHint
          as="h3"
          className="text-base font-bold text-amber-900 dark:text-amber-100"
          hint="아직 발행 주제가 정해지지 않았을 때, 넓은 키워드로 AI가 흥미로운 발행 주제 예시를 제안합니다. 카드를 클릭하면 아래 «발행 주제» 필드에 자동 입력됩니다."
        >
          💡 주제 키워드 가이드
          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">선택 · 1단계</span>
        </TitleWithHint>
        {category === 'video' && (
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
            상단 <strong>숏폼 카테고리</strong>에 맞춰 각 카드의 <strong>angle</strong>에 스토리 전개가 달라집니다.
            (예: 썰 숏츠 → 감동·헌신·꿀팁 / 개그 숏츠 → 해프닝·반전 웃음)
          </p>
        )}
        {category === 'video' &&
          topicGuideSuggestions.length > 0 &&
          topicGuideForCategoryId &&
          topicGuideForCategoryId !== shortformCategoryId && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              카테고리가 변경되었습니다. 아래 결과는 이전 카테고리 기준일 수 있으니 «주제 가이드 받기»를 다시 눌러 주세요.
            </p>
          )}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={seedKeyword}
            onChange={(e) => setSeedKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void fetchTopicKeywordGuide()
            }}
            placeholder="예: 화성, 와우 아제로스 실버문의 주요 역사적 이벤트"
            className="flex-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={() => void fetchTopicKeywordGuide()}
            disabled={topicGuideLoading || seedKeyword.trim().length < 2}
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition"
          >
            {topicGuideLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" color="border-white" />
                제안 생성 중…
              </span>
            ) : (
              '✨ 주제 가이드 받기'
            )}
          </button>
        </div>
        <GuideAiModelSelect
          id="topic-guide-ai-model"
          label="🤖 AI 모델"
          value={topicGuideModel}
          onChange={(m) => {
            setTopicGuideModel(m)
            saveTopicGuideModel(m)
          }}
          compact
        />
        {topicGuideSuggestions.length > 0 && (
          <div className="space-y-2">
            {category === 'video' && findShortformCategory(shortformCategoryId) && (
              <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                📂 {findShortformCategory(shortformCategoryId)?.label} 기준 제안
              </p>
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {topicGuideSuggestions.map((s) => {
                const isSelected = selectedGuideId === s.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => applyGuideSuggestion(s)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-300 dark:ring-indigo-700'
                          : 'border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-gray-900/60 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {s.title}
                      </p>
                      {s.hook && (
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-1 line-clamp-2">
                          훅: {s.hook}
                        </p>
                      )}
                      {s.angle && (
                        <p className="text-[11px] text-violet-800 dark:text-violet-200 mt-2 leading-snug line-clamp-4 bg-violet-50/80 dark:bg-violet-950/30 rounded-lg px-2 py-1.5">
                          <span className="font-semibold">이 카테고리로 풀기:</span> {s.angle}
                        </p>
                      )}
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
                        {isSelected ? '✓ 발행 주제로 설정됨' : '클릭 → 발행 주제 + angle 확인'}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <TopicGuideHistorySection
          items={topicGuideHistoryItems}
          activeId={activeTopicGuideHistoryId}
          isLoading={topicGuideHistoryLoading}
          addToast={addToast}
          onRestore={restoreTopicGuideHistory}
          onRemove={async (id) => {
            await removeTopicGuideHistoryItem(id)
            if (activeTopicGuideHistoryId === id) setActiveTopicGuideHistoryId(null)
          }}
          onClearAll={clearTopicGuideHistory}
        />
      </section>

      {/* ── 2. 발행 주제 (필수) ─────────────────────────────────────── */}
      <section className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-gray-900 p-6 space-y-4 shadow-sm">
        <TitleWithHint
          as="h3"
          className="text-base font-bold text-indigo-900 dark:text-indigo-100"
          hint="이번에 발행할 콘텐츠의 핵심 주제입니다. AI는 이 키워드를 최우선으로 글·스크립트를 작성합니다. 아래 레퍼런스는 선택 사항이며, 구조·톤 참고용입니다."
        >
          ✍️ 발행하고 싶은 주제 · 키워드
          <span className="ml-2 text-xs font-normal text-red-500 dark:text-red-400">필수 · 2단계</span>
        </TitleWithHint>
        <textarea
          value={publishTopic}
          onChange={(e) => {
            persistPublishTopic(e.target.value)
            setSelectedGuideId(null)
          }}
          placeholder={'예: 삼성전자 단기 전망\n하이닉스 1주일 전망\n(쉼표·줄바꿈으로 여러 키워드 입력 가능)'}
          rows={3}
          className="w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[88px]"
        />
        {category === 'video' && (
          <p className="text-[11px] text-violet-700 dark:text-violet-300">
            숏폼 카테고리: <span className="font-semibold">{findShortformCategory(shortformCategoryId)?.label}</span>
            {' '}(상단에서 변경)
          </p>
        )}
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
      </section>

      {/* ── 3. 참고 레퍼런스 (선택) + 급상승·RSS 소스 ───────────────── */}
      <section className="rounded-2xl border-2 border-violet-300 dark:border-violet-800 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-violet-100 dark:border-violet-900/50 bg-gradient-to-r from-violet-600 to-indigo-600">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <TitleWithHint
              as="h3"
              className="text-base font-bold text-white"
              hintVariant="light"
              hint="YouTube·블로그·웹(위키·가이드 사이트 등)을 레퍼런스로 추가할 수 있습니다. «구조·톤»은 목차·문체만, «내용 반영»은 페이지 사실을 스크립트에 반영합니다. 레퍼런스마다 모드를 다르게 설정해 «형태는 A, 내용은 B» 조합도 가능합니다."
            >
              📎 참고 레퍼런스
              <span className="ml-2 text-xs font-normal text-white/60">선택 · 3단계</span>
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
            웹 URL·채널 콘텐츠·급상승·RSS를 참고 레퍼런스로 추가하세요. 카드마다 «구조·톤» / «내용 반영»을 선택할 수 있습니다.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* 소스 탭 */}
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'selected' as const, label: `내 레퍼런스${references.length > 0 ? ` (${references.length})` : ''}` },
              { id: 'trending' as const, label: `🔥 급상승${trendingTopics.length > 0 ? ` (${trendingTopics.length})` : ''}` },
              { id: 'rss' as const, label: `RSS 후보${rssTopics.length > 0 ? ` (${rssTopics.length})` : ''}` },
            ]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRefSourceTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  refSourceTab === tab.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 기획 큐 — 레퍼런스 섹션 상단 (탭과 무관) */}
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

          {/* 탭: 내 레퍼런스 */}
          {refSourceTab === 'selected' && (
            <GuideReferencesPanel
              references={references}
              refsLoaded={refsLoaded}
              publishTopic={publishTopic}
              category={category}
              onReferencesChange={persistReferences}
              onOpenPicker={() => setPickerOpen(true)}
              addToast={addToast}
            />
          )}

          {/* 탭: 급상승 */}
          {refSourceTab === 'trending' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <TitleWithHint
                  as="h4"
                  className="text-sm font-bold text-rose-900 dark:text-rose-200"
                  hint={`${totalFeeds}개 RSS 피드에서 2개 이상 피드가 동시에 다룬 주제를 급상승으로 표시합니다. 카드 클릭 → 레퍼런스 추가.`}
                >
                  🔥 급상승 주제
                  {totalFeeds > 0 && (
                    <span className="ml-2 text-xs font-normal text-rose-600 dark:text-rose-400">
                      ({totalFeeds}개 피드)
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

              {trendingKeywords.length > 0 && (
                <div className="rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 p-3">
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mb-2">YouTube 트렌딩 — 클릭하면 발행 주제에 추가</p>
                  <div className="flex flex-wrap gap-2">
                    {trendingKeywords.slice(0, 6).map((kw) => (
                      <button
                        key={kw.rank}
                        type="button"
                        onClick={() => appendToPublishTopic(kw.keyword)}
                        className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800 text-gray-800 dark:text-gray-100 hover:border-rose-400 transition"
                      >
                        <span className="font-semibold">+ {kw.keyword}</span>
                        <span className="ml-1.5 text-rose-600 dark:text-rose-300 tabular-nums">{kw.rank}위</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORY_TABS.map((tab) => {
                  const stat = categoryStats.find((s) => s.category === tab.id)
                  const count = tab.id === 'all' ? allTopics.length : (stat?.count ?? 0)
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

              <div className="flex gap-2">
                {(['trending', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTrendingTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      trendingTab === tab
                        ? 'bg-rose-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {tab === 'trending'
                      ? `🔥 급상승 ${trendingTopics.length > 0 ? `(${trendingTopics.length})` : ''}`
                      : `전체 ${allTopics.length > 0 ? `(${allTopics.length})` : ''}`}
                  </button>
                ))}
              </div>

              {trendingLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : displayTopics.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500">
                  {trendingTab === 'trending'
                    ? '아직 급상승 주제가 없습니다. n8n «RSS 주제 수집»을 실행하세요.'
                    : '수집된 주제가 없습니다.'}
                </div>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {displayTopics.map((t, idx) => (
                    <li key={`${t.id}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => {
                          addTrendingAsReference(t)
                          setRefSourceTab('selected')
                        }}
                        title="클릭하면 참고 레퍼런스에 추가"
                        className="w-full text-left rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-rose-100 dark:border-rose-900/50 px-3 py-2.5 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                              {t.ai_title ?? t.title}
                            </p>
                            {t.ai_reason && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{t.ai_reason}</p>
                            )}
                          </div>
                          {t.isTrending && (
                            <span className="shrink-0 text-[10px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5">
                              🔥 {t.sourceCount}곳
                            </span>
                          )}
                        </div>
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
            </div>
          )}

          {/* 탭: RSS */}
          {refSourceTab === 'rss' && (
            <div className="space-y-3">
              <TitleWithHint
                as="h4"
                className="text-sm font-bold text-emerald-900 dark:text-emerald-200"
                hint="n8n «RSS 주제 수집» 또는 «주제 선별 AI»에서 저장된 주제입니다. 카드 클릭 → 레퍼런스 추가."
              >
                RSS 주제 후보
              </TitleWithHint>
              {rssLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : rssTopics.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  저장된 주제가 없습니다. n8n «RSS 주제 수집»을 먼저 실행하세요.
                </p>
              ) : (
                <>
                  <ul className="space-y-2 max-h-80 overflow-y-auto">
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
                              hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500
                              opacity-0 group-hover:opacity-100 transition text-xs font-bold"
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              addRssAsReference(t)
                              setRefSourceTab('selected')
                            }}
                            title="클릭하면 참고 레퍼런스에 추가"
                            className="w-full text-left rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-emerald-100 dark:border-emerald-900 px-3 py-2.5 hover:border-violet-300 dark:hover:border-violet-700 transition"
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
                      className="text-xs text-gray-400 hover:text-emerald-600 transition"
                    >
                      숨긴 항목 {hiddenRssIds.size}개 다시 표시
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={generatePublishContent}
            disabled={scriptLoading || !canGenerate}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition ${
              scriptLoading || !canGenerate
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md'
            }`}
          >
            {scriptLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" color="border-white" />
                발행용 콘텐츠 생성 중…
              </span>
            ) : (
              `✨ 내 콘텐츠 생성${
                references.length > 0 ? ` · 레퍼런스 ${references.length}개` : ' · 레퍼런스 0'
              }`
            )}
          </button>
          <GuideAiModelSelect
            id="script-guide-ai-model"
            label="🤖 발행용 콘텐츠 AI 모델"
            value={scriptGuideModel}
            onChange={(m) => {
              setScriptGuideModel(m)
              saveScriptGuideModel(m)
            }}
          />
          <p className="text-[10px] text-center text-gray-400 -mt-2">
            {canGenerate
              ? `주제: «${publishTopic.trim().slice(0, 40)}${publishTopic.trim().length > 40 ? '…' : ''}» · ${getGeminiModelLabel(scriptGuideModel)} · ${CATEGORIES.find((c) => c.id === category)?.label} 가이드`
              : '«발행 주제»를 입력하면 생성할 수 있습니다'}
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
          hint="«내 콘텐츠 생성» 한 번으로 발행용 본문이 나옵니다. 숏폼은 장면별 대본·화면(한글)·Google Flow(Veo) 영문 프롬프트가 포함됩니다. 블로그는 이미지·표 가이드 블록이 포함됩니다."
        >
          생성 결과
        </TitleWithHint>

        {!scriptResult && !scriptLoading && (
          <p className="text-sm text-gray-500 text-center py-8">
            발행 주제를 입력한 뒤 «내 콘텐츠 생성»을 누르면 발행용 본문이 바로 표시되고 히스토리에 저장됩니다.
          </p>
        )}

        {scriptLoading && (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-indigo-600 dark:text-indigo-400">
            <Spinner size="md" />
            {getGeminiModelLabel(scriptGuideModel)}로 발행용 콘텐츠 작성 중…
            {category === 'video' && (
              <p className="text-xs text-gray-500">장면별 대본 + Google Flow 프롬프트 포함</p>
            )}
          </div>
        )}

        {scriptResult && !scriptLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  {polishedResult?.title ?? scriptResult.title}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  발행용 · {getGeminiModelLabel(scriptGuideModel)} ·{' '}
                  {FORMAT_META[scriptResult.targetFormat]?.label ?? scriptResult.targetFormat} ·{' '}
                  {getPlatformName(scriptResult.platform)} ·{' '}
                  {new Date(polishedResult?.polishedAt ?? scriptResult.generatedAt).toLocaleString('ko-KR')}
                </p>
                {polishedResult?.summary && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">{polishedResult.summary}</p>
                )}
              </div>
              <button
                type="button"
                onClick={goToContentStudio}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition shrink-0"
                title="가이드에서 복사·편집으로도 충분하면 생략 가능"
              >
                발행 편집 (선택) →
              </button>
            </div>

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

            <div className="rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 overflow-hidden">
              <div className="px-4 py-2 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                  {category === 'writing'
                    ? '발행용 본문'
                    : category === 'video' && videoMode === 'longform'
                      ? '롱폼 발행용 대본 (챕터별)'
                      : category === 'video'
                        ? '발행용 숏폼 스크립트 (상단 Flow 블록 고정)'
                        : category === 'image'
                          ? '캐러셀 슬라이드 카피'
                          : '발행용 본문'}
                  {polishedResult && polishedResult.imageGuideCount > 0
                    ? ` · 📷 가이드 ${polishedResult.imageGuideCount}`
                    : ''}
                </span>
                <div className="flex flex-wrap gap-2 items-center">
                  {/* 롱폼: YouTube 설명란 챕터 복사 버튼 */}
                  {category === 'video' && videoMode === 'longform' && scriptResult.chapterSummary && scriptResult.chapterSummary.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const lines = scriptResult.chapterSummary!.map((title, i) => {
                          const minutes = Math.floor((i * 90) / 60)
                          const seconds = (i * 90) % 60
                          const ts = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                          return `${ts} ${title}`
                        })
                        void navigator.clipboard.writeText(lines.join('\n'))
                        addToast('YouTube 챕터 타임스탬프 복사됨', 'success')
                      }}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60"
                    >
                      ⏱ 챕터 복사
                    </button>
                  )}
                  {category === 'video' &&
                    listFlowScenePastes(polishedResult?.fullContent ?? scriptResult.fullScript).map(
                      (scene) => (
                        <button
                          key={scene.index}
                          type="button"
                          onClick={() => {
                            const full = polishedResult?.fullContent ?? scriptResult.fullScript
                            const paste =
                              extractFlowScenePaste(full, scene.index) || scene.text
                            if (!paste) {
                              addToast(`씬${scene.index} 블록을 찾지 못습니다`, 'warning')
                              return
                            }
                            void navigator.clipboard.writeText(paste)
                            addToast(`${scene.label} 전체 복사됨 (Flow 붙여넣기)`, 'success')
                          }}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/60"
                        >
                          {scene.label}
                        </button>
                      ),
                    )}
                  {category === 'video' && (
                    <button
                      type="button"
                      onClick={() => {
                        const full = polishedResult?.fullContent ?? scriptResult.fullScript
                        const paste = extractGeminiFlowPasteSection(full)
                        if (!paste) {
                          addToast('Flow 붙여넣기 블록을 찾지 못습니다', 'warning')
                          return
                        }
                        void navigator.clipboard.writeText(paste)
                        addToast('모든 씬 Flow 블록 복사됨', 'success')
                      }}
                      className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Flow 전체
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const text = polishedResult?.fullContent ?? scriptResult.fullScript
                      void navigator.clipboard.writeText(text)
                      addToast('전체 복사되었습니다', 'success')
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    전체 복사
                  </button>
                </div>
              </div>
              <pre className="p-4 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed max-h-[520px] overflow-y-auto">
                {polishedResult?.fullContent ?? scriptResult.fullScript}
              </pre>
            </div>

            {scriptResult.cta && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">CTA:</span> {scriptResult.cta}
              </p>
            )}

            {polishedResult && category === 'writing' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
                📷 «환기용 이미지 가이드»·«표 가이드» 블록은 직접 제작·삽입할 위치 안내입니다.
              </p>
            )}

            {polishedResult && category === 'video' && videoMode === 'shortform' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg px-3 py-2">
                📋 <strong>씬N</strong> 버튼으로 해당 씬 블록 전체를 복사한 뒤 Google Flow에 붙여넣으세요. Flow 영문은 상단에만 있고 발행 스크립트와 중복되지 않습니다. 플랫폼 스펙:{' '}
                <a
                  href="https://branderkey.notion.site/33c835c9591a8008b0cef37fcf50043f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 underline"
                >
                  Branderkey 가이드
                </a>
                기준입니다.
              </p>
            )}
            {polishedResult && category === 'video' && videoMode === 'longform' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg px-3 py-2">
                🎞️ <strong>⏱ 챕터 복사</strong> 버튼으로 YouTube 설명란에 바로 붙여넣을 타임스탬프 블록을 복사하세요. 챕터 순서대로 90초 간격으로 자동 계산됩니다.
              </p>
            )}
            {category === 'image' && scriptResult && (
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-pink-50/50 dark:bg-pink-950/20 rounded-lg px-3 py-2">
                🖼️ 슬라이드별 카피를 복사해 <strong>Canva</strong>에 붙여넣으세요. 각 슬라이드는 <code>## 슬라이드 N</code> 형식으로 구분됩니다.
              </p>
            )}

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              위 «전체 복사»·씬별 Flow 복사로 바로 제작 가능합니다. 문장만 더 다듬거나 .txt로 보낼 때만{' '}
              <button
                type="button"
                onClick={goToContentStudio}
                className="font-semibold text-indigo-600 dark:text-indigo-400 underline"
              >
                발행 편집·변환
              </button>
              으로 이동하세요.
            </p>
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
