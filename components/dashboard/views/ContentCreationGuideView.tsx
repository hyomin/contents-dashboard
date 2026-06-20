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
  categoryToDefaultFormat,
  categoryToDefaultPlatform,
  saveContentStudioImport,
} from '@/lib/dashboard/content-studio-import'
import type { RssTopicCandidateRow } from '@/lib/data/rss-topic-collect'
import type { TrendingTopic, RssTrendingResponse, CategoryStat } from '@/app/api/dashboard/rss-trending/route'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'
import { PageLoadingOverlay, Spinner } from '@/components/dashboard/ui/loading'
import { GuideReferencePickerModal } from '@/components/dashboard/GuideReferencePickerModal'
import { GenerationResultView } from '@/components/dashboard/GenerationResultView'
import { StockReportPanel, type StockDailyItemResult } from '@/components/dashboard/StockReportPanel'
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
import { usePlanningQueue, SOURCE_LABELS, CATEGORY_LABELS } from '@/lib/hooks/use-planning-queue'
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
import {
  EMOTION_TONES,
  findEmotionTone,
  loadSelectedEmotionToneId,
  saveSelectedEmotionToneId,
  type EmotionToneId,
} from '@/lib/dashboard/emotion-tones'

// ─── 레퍼런스 기반 주제 분석 타입 ─────────────────────────────────
interface BmRefUrl { id: string; url: string; title: string; vsAvg: string }
interface BenchmarkSuggestion { title: string; hook: string; structure: string[]; keywords: string[]; estimatedVsAvg: string; reasoning: string }
const BM_PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'naver-blog', label: '네이버 블로그' },
  { value: 'tistory', label: '티스토리' },
] as const
function detectBmPlatform(url: string) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return '🔴'
  if (url.includes('instagram.com')) return '💗'
  if (url.includes('blog.naver.com')) return '🟢'
  if (url.includes('tistory.com')) return '🟠'
  return '🔗'
}

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

/** 주제 제안 카드 클릭 시 전체 내용을 보여주는 미리보기 팝업 (카드 안에서 잘리는 텍스트 보완용) */
function TopicSuggestionPreviewModal({
  suggestion,
  isSelected,
  categoryLabel,
  onSelect,
  onClose,
}: {
  suggestion: TopicKeywordGuideSuggestion
  isSelected: boolean
  categoryLabel?: string
  onSelect: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-100 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">주제 제안 미리보기</h3>
            {categoryLabel && (
              <p className="text-xs text-violet-600 dark:text-violet-300 mt-0.5">📂 {categoryLabel} 기준 제안</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">제목</p>
            <p className="text-base font-bold text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
              {suggestion.title}
            </p>
          </div>
          {suggestion.hook && (
            <div>
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">훅</p>
              <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                {suggestion.hook}
              </p>
            </div>
          )}
          {suggestion.angle && (
            <div>
              <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 mb-1">이 카테고리로 풀기</p>
              <p className="text-sm text-violet-900 dark:text-violet-100 whitespace-pre-wrap leading-relaxed bg-violet-50/80 dark:bg-violet-950/30 rounded-xl px-3 py-2.5">
                {suggestion.angle}
              </p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onSelect}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              isSelected
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isSelected ? '✓ 발행 주제로 설정됨' : '주제로 선정하기'}
          </button>
        </div>
      </div>
    </div>
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
  // AI 인사이트에서 넘어온 경우 포맷 자동 설정 — localStorage 저장 없이 세션 내에서만 적용
  const insightFormatRef = useRef<string | null>(null)
  const [fromInsightFormat, setFromInsightFormat] = useState<string | null>(null)
  const [category, setCategory] = useState<GuideCategory>('video')
  const [stockReportMode, setStockReportMode] = useState(false)
  const [stockDailyResults, setStockDailyResults] = useState<StockDailyItemResult[]>([])
  const [activeStockResultKey, setActiveStockResultKey] = useState<string | null>(null)
  const resultSectionRef = useRef<HTMLElement>(null)
  const [videoMode, setVideoMode] = useState<VideoMode>('shortform')
  const [shortformCategoryId, setShortformCategoryId] = useState(
    () => BUILTIN_SHORTFORM_CATEGORIES[0].id,
  )
  // 추구하는 감정 톤 — «콘텐츠 카테고리»와는 별개 축 (예: 동물 숏츠 + 감동 vs 동물 숏츠 + 개그)
  const [emotionTone, setEmotionTone] = useState<EmotionToneId>('none')
  const [publishTopic, setPublishTopic] = useState('')
  const [publishTopicLoaded, setPublishTopicLoaded] = useState(false)
  const [references, setReferences] = useState<GuideReference[]>([])
  const [refsLoaded, setRefsLoaded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [sidebarTab, setSidebarTab] = useState<'tips' | 'history'>('tips')
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
    reload: reloadHistory,
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
  // AI 생성(1회) → 기록 저장(백그라운드, AI 호출 아님) 두 단계를 명확히 구분해 보여주기 위한 상태
  const [topicGuideStage, setTopicGuideStage] = useState<'idle' | 'generating' | 'saving' | 'done'>('idle')
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)
  const [previewGuideSuggestion, setPreviewGuideSuggestion] = useState<TopicKeywordGuideSuggestion | null>(null)
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

  // 레퍼런스 기반 주제 분석
  const [topicMode, setTopicMode] = useState<'keyword' | 'benchmark'>('keyword')
  const [benchmarkUrls, setBenchmarkUrls] = useState<BmRefUrl[]>([])
  const [benchmarkSuggestions, setBenchmarkSuggestions] = useState<BenchmarkSuggestion[] | null>(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkPlatform, setBenchmarkPlatform] = useState('youtube')
  const [newBmUrl, setNewBmUrl] = useState('')
  const [newBmTitle, setNewBmTitle] = useState('')

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

  const autoFillBenchmarks = useCallback(async () => {
    setBenchmarkLoading(true)
    try {
      const res = await fetch('/api/dashboard/benchmarks')
      if (!res.ok) throw new Error()
      type DBBm = { id: string; url: string; title: string; vs_avg: number | null }
      const data = (await res.json()) as DBBm[]
      const filtered = data
        .filter((b) => b.url && b.title)
        .sort((a, b) => (b.vs_avg ?? 0) - (a.vs_avg ?? 0))
        .slice(0, 8)
      if (filtered.length === 0) { addToast('등록된 레퍼런스가 없습니다', 'warning'); return }
      setBenchmarkUrls((prev) => {
        const existing = new Set(prev.map((u) => u.url))
        const added = filtered
          .filter((b) => !existing.has(b.url))
          .map((b) => ({ id: `bm-${b.id}`, url: b.url, title: b.title, vsAvg: b.vs_avg != null ? b.vs_avg.toFixed(1) : '?' }))
        if (added.length === 0) { addToast('이미 모두 추가됐습니다', 'info'); return prev }
        addToast(`벤치마크 ${added.length}개 자동 추가 ✅`, 'success')
        return [...prev, ...added]
      })
    } catch { addToast('벤치마크 로드 실패', 'warning') }
    finally { setBenchmarkLoading(false) }
  }, [addToast])

  const runBenchmarkAnalysis = async () => {
    setBenchmarkLoading(true)
    setBenchmarkSuggestions(null)
    try {
      const catLabel =
        category === 'video'
          ? (findShortformCategory(shortformCategoryId)?.label ?? 'video')
          : category === 'writing' ? '글쓰기' : '캐러셀'
      const res = await fetch('/api/topic-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: catLabel,
          platform: benchmarkPlatform,
          urls: benchmarkUrls,
          trendingKeywords: trendingKeywords.map((k) => k.keyword).slice(0, 8),
        }),
      })
      const data = (await res.json()) as { suggestions?: BenchmarkSuggestion[]; error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? '분석 실패. GEMINI_API_KEY를 확인해주세요', 'warning')
      } else if (Array.isArray(data.suggestions)) {
        setBenchmarkSuggestions(data.suggestions)
        addToast('레퍼런스 분석 완료 🎯', 'success')
      } else {
        addToast('결과를 가져오지 못했습니다', 'warning')
      }
    } catch { addToast('네트워크 오류', 'warning') }
    finally { setBenchmarkLoading(false) }
  }

  const addBmUrl = () => {
    if (!newBmUrl.trim()) return
    setBenchmarkUrls((prev) => [
      ...prev,
      { id: Date.now().toString(), url: newBmUrl.trim(), title: newBmTitle.trim() || newBmUrl.trim(), vsAvg: '?' },
    ])
    setNewBmUrl('')
    setNewBmTitle('')
  }

  useEffect(() => {
    setReferences(loadGuideReferences())
    setRefsLoaded(true)

    // topic → 발행 주제 (AI 인사이트의 action 필드 = 짧은 추천 액션)
    const fromUrl = searchParams.get('topic')?.trim()
    setPublishTopic(fromUrl || loadPublishTopic())
    setPublishTopicLoaded(true)

    // seedKeyword → 주제 키워드 가이드 입력 자동 채우기 (AI 인사이트의 text 필드 = 설명 문장)
    const seedFromUrl = searchParams.get('seedKeyword')
    if (seedFromUrl) {
      try {
        setSeedKeyword(decodeURIComponent(seedFromUrl).trim())
      } catch {
        setSeedKeyword(seedFromUrl.trim())
      }
    }

    // insightFormat → 포맷 자동 설정 (AI 인사이트에서 넘어온 경우)
    // localStorage 저장 없이 세션 내에서만 적용 (사용자 기존 설정 보호)
    const insightFormat = searchParams.get('insightFormat')
    insightFormatRef.current = insightFormat
    if (insightFormat) {
      setFromInsightFormat(insightFormat)
      if (insightFormat === 'writing') {
        setCategory('writing')
      } else if (insightFormat === 'image') {
        setCategory('image')
      } else if (insightFormat === 'longform') {
        setCategory('video')
        setVideoMode('longform')
      } else if (insightFormat === 'shortform') {
        setCategory('video')
        setVideoMode('shortform')
      }
    } else {
      setFromInsightFormat(null)
    }
  }, [searchParams])

  useEffect(() => {
    // AI 인사이트에서 shortform으로 진입한 경우 localStorage 숏폼 카테고리를 적용하지 않음
    // (저장된 "동물 숏츠" 등이 트렌드 기반 주제와 맞지 않을 수 있으므로 기본값 유지)
    if (insightFormatRef.current !== 'shortform') {
      setShortformCategoryId(loadSelectedShortformCategoryId())
    }
    setEmotionTone(loadSelectedEmotionToneId())
  }, [])

  const handleEmotionToneChange = useCallback((id: EmotionToneId) => {
    setEmotionTone(id)
    saveSelectedEmotionToneId(id)
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
    const isShortformVideo = category === 'video' && videoMode === 'shortform'
    const isLongformVideo = category === 'video' && videoMode === 'longform'
    const sfLabel = isShortformVideo ? findShortformCategory(shortformCategoryId)?.label : undefined
    const emotionLabel =
      category === 'video' && emotionTone !== 'none' ? findEmotionTone(emotionTone)?.label : undefined
    const formatLine =
      (isLongformVideo
        ? '\n포맷: 롱폼 영상 (8~12분 · 챕터 구성)'
        : sfLabel
          ? `\n숏폼 카테고리: ${sfLabel}`
          : '') + (emotionLabel ? `\n추구하는 감정 톤: ${emotionLabel}` : '')
    const angleHint = isLongformVideo
      ? '제안마다 «angle»에 8~12분 롱폼으로 풀어낼 챕터 전개 방향이 반영됩니다.'
      : '제안마다 «angle»에 위 카테고리 장르(스토리 전개·톤)가 반영됩니다.'
    const toneHint = emotionLabel ? ` 선택한 «${emotionLabel}» 톤에 맞는 전개·결말로만 제안됩니다.` : ''
    const ok = window.confirm(
      `주제 가이드를 생성할까요?\n\n키워드: ${seedKeyword.trim()}${formatLine}\nAI 모델: ${modelLabel}\n\n${angleHint}${toneHint}\nGemini API가 호출됩니다 (약 10~30초).`,
    )
    if (!ok) return

    setTopicGuideLoading(true)
    setTopicGuideStage('generating')
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
          shortformCategoryId: isShortformVideo ? shortformCategoryId : undefined,
          videoMode: category === 'video' ? videoMode : undefined,
          emotionTone: category === 'video' && emotionTone !== 'none' ? emotionTone : undefined,
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
        setTopicGuideStage('done')
        addToast('제안을 생성하지 못했습니다. 키워드를 바꿔 다시 시도해 주세요.', 'warning')
      } else {
        // ↓ 여기는 AI를 다시 호출하지 않습니다. 방금 받은 결과를 기록 목록에 저장만 하는 단계입니다.
        setTopicGuideStage('saving')
        const historyId = await addFromGuide({
          seedKeyword: seedKeyword.trim(),
          category,
          suggestions,
          guideGeneratedAt: data.generatedAt,
        })
        setTopicGuideStage('done')
        if (historyId) {
          setActiveTopicGuideHistoryId(historyId)
          addToast(`✨ 주제 가이드 ${suggestions.length}개 생성 완료 (AI 호출 1회 · 기록도 함께 저장됨)`, 'success')
        } else {
          addToast(`✨ 주제 가이드 ${suggestions.length}개 생성 완료 (AI 호출 1회 · 기록 저장만 실패)`, 'warning')
        }
      }
    } catch {
      setTopicGuideStage('idle')
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
          ? '\n · [0~N초] 장면별 대본 + 화면 묘사(한글) + 자막·편집 메모'
          : category === 'video' && videoMode === 'longform'
            ? '\n · 챕터별 완성 대본 + YouTube 설명란 타임스탬프'
            : ''
    const videoLabel =
      category === 'video'
        ? VIDEO_MODE_TABS.find((t) => t.id === videoMode)?.label ?? videoMode
        : CATEGORIES.find((c) => c.id === category)?.label ?? category
    const emotionLine =
      category === 'video' && emotionTone !== 'none'
        ? `\n추구하는 감정 톤: ${findEmotionTone(emotionTone)?.icon ?? ''} ${findEmotionTone(emotionTone)?.label ?? ''}`
        : ''
    const ok = window.confirm(
      `발행용 콘텐츠를 생성할까요?\n\n발행 주제: ${topicPreview}\nAI 모델: ${modelLabel}\n${refLine}\n포맷: ${videoLabel}${category === 'video' && videoMode === 'shortform' ? `\n숏폼 카테고리: ${findShortformCategory(shortformCategoryId)?.label ?? shortformCategoryId}` : ''}${emotionLine}${polishHint}\n\n(n8n Gemini 1회 호출 · 가이드 초안 단계 없음)`,
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
        warning?: string
      }
      if (!res.ok || data.error) {
        addToast(data.error ?? '발행용 콘텐츠 생성 실패', 'warning')
      } else {
        const polished = data.polished ?? null
        const { polished: _p, warning: _w, ...script } = data
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
        if (data.warning) addToast(data.warning, 'warning')
      }
    } catch {
      addToast('네트워크 오류가 발생했습니다', 'warning')
    } finally {
      setScriptLoading(false)
    }
  }

  const goToContentStudioFromHistory = (item: GenerationHistoryItem) => {
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
      title: polished?.title ?? draft.title,
      body: polished?.fullContent ?? draft.fullScript,
      notes: [
        `히스토리 · ${draft.mode === 'n8n' ? 'n8n Gemini' : '대시보드 AI'}`,
        item.publishTopic ? `주제: ${item.publishTopic}` : draft.topic ? `주제: ${draft.topic}` : '',
        polished?.summary ? polished.summary : '',
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

  const loadFromHistory = (item: GenerationHistoryItem, silent = false) => {
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
    loadFromHistory(item, true)
  }, [searchParams, historyItems, historyLoading])

  const goToContentStudio = () => {
    if (!scriptResult) return
    const platform =
      references.find((r) => r.platform && r.platform !== 'topic' && r.platform !== 'insight')?.platform ??
      scriptResult.platform ??
      categoryToDefaultPlatform(category)
    const format = scriptResult.targetFormat ?? categoryToDefaultFormat(category)
    saveContentStudioImport({
      platform,
      format,
      title: polishedResult?.title ?? scriptResult.title,
      body: polishedResult?.fullContent ?? scriptResult.fullScript,
      notes: [
        '발행용 콘텐츠 · Gemini',
        scriptResult.topic ? `주제: ${scriptResult.topic}` : '',
        polishedResult?.summary ? polishedResult.summary : '',
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
  const activeSections = guide.sections.filter((sec) =>
    !sec.modes || (category === 'video' && sec.modes.includes(videoMode as 'shortform' | 'longform'))
  )

  const guideContext = useMemo(
    (): AiScriptGuideRequestContext => ({
      category,
      shortformCategoryId: category === 'video' && videoMode === 'shortform' ? shortformCategoryId : undefined,
      emotionTone: category === 'video' ? emotionTone : undefined,
      userTopic: publishTopic.trim(),
      keywords: parsePublishKeywords(publishTopic),
      referenceTitles: references.map((r) => r.title),
      references: references.map(guideRefToAi),
      intent: mapCategoryToIntent(category, videoMode),
      aiModel: scriptGuideModel,
    }),
    [category, videoMode, shortformCategoryId, emotionTone, publishTopic, references, scriptGuideModel],
  )

  const canGenerate = publishTopic.trim().length >= 2

  const displayTopics = trendingTab === 'trending' ? trendingTopics : allTopics

  const isPageLoading = rssLoading && rssTopics.length === 0

  return (
    <PageLoadingOverlay loading={isPageLoading} label="콘텐츠 가이드 데이터를 불러오는 중…">
    <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
    <div className="flex-1 min-w-0 lg:max-w-3xl space-y-6">
      <N8nLv1ServicesSection viewId="content-guide" addToast={addToast} />

      {/* ── AI 인사이트 유입 배너 ─────────────────────────────────── */}
      {fromInsightFormat && (() => {
        const fmtLabel: Record<string, string> = {
          shortform: '숏폼 영상 (60초 이내)',
          longform: '롱폼 영상 (5분 이상)',
          writing: '글쓰기 · 블로그',
          image: '캐러셀 · 카드뉴스',
        }
        return (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
            <span className="text-base">💡</span>
            <span>
              AI 인사이트 추천 포맷: <strong>{fmtLabel[fromInsightFormat] ?? fromInsightFormat}</strong>으로 자동 설정됐습니다.
              {fromInsightFormat === 'shortform' && ' 숏폼 카테고리는 아래에서 직접 선택해 주세요.'}
            </span>
          </div>
        )
      })()}

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

            {/* 추구하는 감정 톤 — 콘텐츠 카테고리와 별개 축. 같은 «동물 숏츠»라도 감동/개그/분노는 톤이 전혀 다르므로 별도 지정 */}
            <div className="space-y-1.5">
              <TitleWithHint
                as="p"
                className="text-xs font-bold text-indigo-800 dark:text-indigo-200"
                hint="콘텐츠 카테고리(예: 동물 숏츠)와는 별개 축입니다. 같은 카테고리라도 «감동»을 원하는데 결과가 개그·분노 톤으로 나오는 걸 막기 위해, 추구하는 감정을 직접 지정하면 주제 제안·대본 모두 그 톤에 맞춰 생성됩니다."
              >
                💗 추구하는 감정 톤
                <span className="ml-1.5 font-normal text-indigo-600/70 dark:text-indigo-300/70">(선택)</span>
              </TitleWithHint>
              <div className="flex flex-wrap gap-1.5">
                {EMOTION_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => handleEmotionToneChange(tone.id)}
                    title={tone.description}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      emotionTone === tone.id
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-pink-100 dark:hover:bg-pink-900/30'
                    }`}
                  >
                    <span>{tone.icon}</span>
                    {tone.label}
                  </button>
                ))}
              </div>
              {emotionTone !== 'none' && (
                <p className="text-[11px] text-pink-700/80 dark:text-pink-300/80">
                  «{findShortformCategory(shortformCategoryId)?.label ?? '선택한 카테고리'}»여도, 이 톤({findEmotionTone(emotionTone)?.label})에 맞는 전개·결말로만 주제·대본이 생성됩니다.
                </p>
              )}
            </div>
          </div>
        )}
        {category === 'writing' && (
          <div className="mt-4 pt-4 border-t border-violet-100 dark:border-violet-900/50">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStockReportMode(false)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
                  ${
                    !stockReportMode
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                  }`}
              >
                📝 일반 주제 작성
              </button>
              <button
                type="button"
                onClick={() => setStockReportMode(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition
                  ${
                    stockReportMode
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                  }`}
              >
                📈 주식 일일 리포트
              </button>
            </div>
          </div>
        )}
      </section>

      {category === 'writing' && stockReportMode && (
        <StockReportPanel
          addToast={addToast}
          onGenerated={(script, polished, historyId) => {
            setScriptResult(script)
            setPolishedResult(polished)
            setActiveHistoryId(historyId)
            persistPublishTopic(script.topic)
            // 하단 결과 영역으로 자동 스크롤
            setTimeout(() => resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
          }}
          onDailyResults={(items) => {
            setStockDailyResults(items)
            const firstOk = items.find((i) => i.ok)
            if (firstOk) setActiveStockResultKey(`${firstOk.market}:${firstOk.ticker}`)
          }}
          onSaved={() => void reloadHistory()}
        />
      )}

      {/* ── 1. 주제 가이드 / 2. 발행 주제 / 3. 참고 레퍼런스 — 주식 일일 리포트 모드에서 숨김 */}
      {!(category === 'writing' && stockReportMode) && (<>
      {/* ── 1. 주제 키워드 가이드 (발행 주제 입력 전) ─────────────── */}
      <section className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 p-6 space-y-4 shadow-sm">
        <TitleWithHint
          as="h3"
          className="text-base font-bold text-amber-900 dark:text-amber-100"
          hint="아직 발행 주제가 정해지지 않았을 때, 넓은 키워드로 AI가 흥미로운 발행 주제 예시를 제안합니다. 카드를 클릭하면 아래 «발행 주제» 필드에 자동 입력됩니다."
        >
          💡 주제 가이드
          <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">선택 · 1단계</span>
        </TitleWithHint>

        {/* 모드 토글: 키워드 찾기 vs 레퍼런스 분석 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setTopicMode('keyword'); setBenchmarkSuggestions(null) }}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              topicMode === 'keyword'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            💡 키워드로 찾기
          </button>
          <button
            type="button"
            onClick={() => setTopicMode('benchmark')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              topicMode === 'benchmark'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
            }`}
          >
            📊 레퍼런스 분석
          </button>
        </div>

        {topicMode === 'keyword' && (<>
        {category === 'video' && videoMode === 'shortform' && (
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
            상단 <strong>숏폼 카테고리</strong>에 맞춰 각 카드의 <strong>angle</strong>에 스토리 전개가 달라집니다.
            (예: 썰 숏츠 → 감동·헌신·꿀팁 / 개그 숏츠 → 해프닝·반전 웃음)
          </p>
        )}
        {category === 'video' && videoMode === 'longform' && (
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
            <strong>롱폼(8~12분)</strong> 기준으로 각 카드의 <strong>angle</strong>에 챕터 전개 방향이 반영됩니다.
          </p>
        )}
        {category === 'video' &&
          videoMode === 'shortform' &&
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
        {topicGuideStage !== 'idle' && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] rounded-lg bg-amber-100/60 dark:bg-amber-900/20 px-3 py-2">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                topicGuideStage === 'generating' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {topicGuideStage === 'generating' ? <Spinner size="sm" /> : '✅'} ① AI 주제 생성 (Gemini 호출 1회)
            </span>
            <span className="text-amber-400">→</span>
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                topicGuideStage === 'generating'
                  ? 'text-gray-400 dark:text-gray-500'
                  : topicGuideStage === 'saving'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {topicGuideStage === 'saving' ? <Spinner size="sm" /> : topicGuideStage === 'generating' ? '⏳' : '✅'} ② 결과 기록 저장 (AI 재호출 아님 · 단순 저장)
            </span>
          </div>
        )}
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
                      onClick={() => setPreviewGuideSuggestion(s)}
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
                        {isSelected ? '✓ 발행 주제로 설정됨' : '클릭 → 전체 보기 · 선정'}
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
        </>)}

        {/* ── 레퍼런스 분석 모드 ─────────────────────────────────────── */}
        {topicMode === 'benchmark' && (
          <div className="space-y-4">
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
              성과 높은 콘텐츠를 레퍼런스로 추가하면 AI가 패턴을 분석해 주제·훅·구성안을 제안합니다.
            </p>

            {/* 플랫폼 */}
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">대상 플랫폼</p>
              <div className="flex gap-2 flex-wrap">
                {BM_PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setBenchmarkPlatform(p.value)}
                    className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition ${
                      benchmarkPlatform === p.value
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:border-amber-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 벤치마크 자동 채우기 */}
            <button
              type="button"
              onClick={() => void autoFillBenchmarks()}
              disabled={benchmarkLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm border border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-xl hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 disabled:opacity-50 transition"
            >
              {benchmarkLoading && !benchmarkSuggestions ? (
                <><Spinner size="sm" color="border-amber-400" /> 불러오는 중…</>
              ) : (
                '📊 등록된 벤치마크에서 자동 추가'
              )}
            </button>

            {/* URL 목록 */}
            {benchmarkUrls.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {benchmarkUrls.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900/60 rounded-xl border border-amber-100 dark:border-amber-900/50 group">
                    <span className="text-sm shrink-0">{detectBmPlatform(u.url)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{u.title}</p>
                      <p className="text-xs text-gray-400 truncate">{u.url}</p>
                    </div>
                    {u.vsAvg !== '?' && <span className="text-xs font-bold text-green-600 shrink-0">{u.vsAvg}x</span>}
                    <button
                      type="button"
                      onClick={() => setBenchmarkUrls((prev) => prev.filter((x) => x.id !== u.id))}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 수동 URL 추가 */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newBmUrl}
                  onChange={(e) => setNewBmUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBmUrl()}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                />
                <input
                  value={newBmTitle}
                  onChange={(e) => setNewBmTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBmUrl()}
                  placeholder="제목 (선택)"
                  className="w-28 px-3 py-2 text-sm rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={addBmUrl}
                disabled={!newBmUrl.trim()}
                className="w-full py-2 text-xs border border-dashed border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 rounded-xl hover:border-amber-400 disabled:opacity-40 transition"
              >
                + URL 직접 추가
              </button>
            </div>

            {/* 분석 버튼 */}
            <button
              type="button"
              onClick={() => void runBenchmarkAnalysis()}
              disabled={benchmarkLoading}
              className={`w-full py-3 rounded-xl text-sm font-bold transition ${
                benchmarkLoading
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-600 to-orange-500 text-white hover:from-amber-700 hover:to-orange-600 shadow-sm'
              }`}
            >
              {benchmarkLoading && !benchmarkSuggestions ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" color="border-white" /> 패턴 분석 중…
                </span>
              ) : (
                '🎯 레퍼런스 패턴 분석'
              )}
            </button>

            {/* 분석 결과 */}
            {benchmarkSuggestions && benchmarkSuggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  추천 주제 {benchmarkSuggestions.length}개
                </p>
                {benchmarkSuggestions.map((s, i) => (
                  <div key={i} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white/90 dark:bg-gray-900/60 overflow-hidden">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{s.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium">
                          예상 {s.estimatedVsAvg}
                        </span>
                        {s.keywords.map((k) => (
                          <span key={k} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] rounded-full">
                            #{k}
                          </span>
                        ))}
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-0.5">⚡ 오프닝 훅</p>
                        <p className="text-xs text-amber-800 dark:text-amber-300">{s.hook}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 italic">🔍 {s.reasoning}</p>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-amber-100 dark:border-amber-900/50">
                      <button
                        type="button"
                        onClick={() => {
                          persistPublishTopic(s.title)
                          addToast(`"${s.title.slice(0, 20)}…" 발행 주제로 설정됐습니다 ✓`, 'success')
                        }}
                        className="w-full py-2 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                      >
                        ✓ 이 주제로 선정
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
                              <div className="flex items-center gap-1 mt-1.5">
                                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold ${src.color}`}>
                                  {src.label}
                                </span>
                                {item.category && (
                                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold ${CATEGORY_LABELS[item.category].color}`}>
                                    {CATEGORY_LABELS[item.category].label}
                                  </span>
                                )}
                              </div>
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
      </>)}

      {/* ── 생성 결과 ───────────────────────────────────────────── */}
      <section
        ref={resultSectionRef}
        id="result-section"
        className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-6 space-y-4"
      >
        <TitleWithHint
          as="h3"
          className="text-lg font-bold text-indigo-900 dark:text-indigo-200"
          hint="«내 콘텐츠 생성» 한 번으로 발행용 본문이 나옵니다. 숏폼은 장면별 대본·화면 묘사·자막·편집 메모가, 롱폼은 챕터별 내레이션 전체 대본·설명란 타임스탬프가 포함됩니다. 블로그는 이미지·표 가이드 블록이 포함됩니다."
        >
          생성 결과
        </TitleWithHint>

        {/* 주식 일일 리포트 종목 선택 내비게이션 */}
        {category === 'writing' && stockReportMode && stockDailyResults.length > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              📋 일일 리포트 종목 선택 — 클릭하면 아래에 내용이 표시됩니다
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stockDailyResults.map((r) => {
                const key = `${r.market}:${r.ticker}`
                const isActive = activeStockResultKey === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!r.ok}
                    onClick={() => {
                      if (!r.ok || !r.script || !r.polished) return
                      setActiveStockResultKey(key)
                      setScriptResult(r.script)
                      setPolishedResult(r.polished)
                      setActiveHistoryId(r.historyId ?? null)
                      persistPublishTopic(r.script.topic)
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                      !r.ok
                        ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        : isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/70'
                    }`}
                  >
                    <span>{r.ok ? '✅' : '⏭'}</span>
                    {r.name}
                    {r.historyId && r.ok && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); window.open(`/api/dashboard/content-output-html?historyId=${encodeURIComponent(r.historyId!)}`, '_blank') }}
                        className="ml-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
                        title="HTML 보기"
                      >
                        HTML
                      </button>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[9px] text-gray-400 dark:text-gray-500">
              ⏭ = 시세 없음(skip) · ✅ = 리포트 생성 완료 · HTML 링크는 발행용 HTML 새 탭
            </p>
          </div>
        )}

        {!scriptResult && !scriptLoading && (
          <p className="text-sm text-gray-500 text-center py-8">
            {category === 'writing' && stockReportMode
              ? '상단에서 «오늘 리포트 생성»을 실행하면 종목별 리포트가 자동으로 여기에 표시됩니다.'
              : '발행 주제를 입력한 뒤 «내 콘텐츠 생성»을 누르면 발행용 본문이 바로 표시되고 히스토리에 저장됩니다.'}
          </p>
        )}

        {scriptLoading && (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-indigo-600 dark:text-indigo-400">
            <Spinner size="md" />
            {getGeminiModelLabel(scriptGuideModel)}로 발행용 콘텐츠 작성 중…
            {category === 'video' && videoMode === 'shortform' && (
              <p className="text-xs text-gray-500">장면별 대본 + 편집 메모 포함</p>
            )}
            {category === 'video' && videoMode === 'longform' && (
              <p className="text-xs text-gray-500">챕터별 내레이션 전체 대본 + 설명란 타임스탬프 포함</p>
            )}
          </div>
        )}

        {scriptResult && !scriptLoading && (
          <GenerationResultView
            result={scriptResult}
            polished={polishedResult}
            modeLabel={getGeminiModelLabel(scriptGuideModel)}
            addToast={addToast}
            onGoToStudio={goToContentStudio}
            historyId={activeHistoryId}
          />
        )}
      </section>
    </div>

    {/* ── 오른쪽: 제작 팁 / 히스토리 (플로팅 + 독자 스크롤) ───────────── */}
    <aside className="lg:w-[22rem] xl:w-96 shrink-0">
      <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col gap-3">
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarTab('tips')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${
              sidebarTab === 'tips'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-violet-300'
            }`}
          >
            💡 제작 팁
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('history')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${
              sidebarTab === 'history'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-violet-300'
            }`}
          >
            📚 히스토리{historyItems.length > 0 ? ` (${historyItems.length})` : ''}
          </button>
        </div>

        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {sidebarTab === 'tips' ? (
            <section className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                💡 {CATEGORIES.find((c) => c.id === category)?.icon} {guide.title} 제작 팁
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
              {activeSections.map((sec, i) => (
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
            </section>
          ) : (
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
          )}
        </div>
      </div>
    </aside>
    </div>
    <GuideReferencePickerModal
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={addReference}
      addToast={addToast}
    />
    {previewGuideSuggestion && (
      <TopicSuggestionPreviewModal
        suggestion={previewGuideSuggestion}
        isSelected={selectedGuideId === previewGuideSuggestion.id}
        categoryLabel={category === 'video' ? findShortformCategory(shortformCategoryId)?.label : undefined}
        onSelect={() => {
          applyGuideSuggestion(previewGuideSuggestion)
          setPreviewGuideSuggestion(null)
        }}
        onClose={() => setPreviewGuideSuggestion(null)}
      />
    )}
    </PageLoadingOverlay>
  )
}
