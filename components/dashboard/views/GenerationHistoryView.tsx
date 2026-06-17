'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  categoryToDefaultFormat,
  categoryToDefaultPlatform,
  saveContentStudioImport,
} from '@/lib/dashboard/content-studio-import'
import { useGenerationHistory } from '@/lib/hooks/use-generation-history'
import type { GenerationHistoryItem } from '@/lib/dashboard/generation-history-types'
import { GenerationHistoryList } from '@/components/dashboard/GenerationHistoryList'
import { ContentAnalyzerHistorySection } from '@/components/dashboard/ContentAnalyzerHistorySection'
import {
  clearContentAnalyzerHistory,
  loadContentAnalyzerHistory,
  removeContentAnalyzerHistoryItem,
  type ContentAnalyzerHistoryItem,
} from '@/lib/dashboard/content-analyzer-history'
import { PageLoadingOverlay } from '@/components/dashboard/ui/loading'

type HistoryCategory = 'guide' | 'analyzer'

type GuideFormatFilter = 'all' | 'video' | 'writing' | 'image'

const GUIDE_FORMAT_FILTERS: { id: GuideFormatFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'video', label: '영상' },
  { id: 'writing', label: '글' },
  { id: 'image', label: '카드뉴스' },
]

export default function GenerationHistoryView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('id')
  const categoryParam = searchParams.get('category') === 'analyzer' ? 'analyzer' : 'guide'

  const { items, isLoading, removeItem, clearAll, reload } = useGenerationHistory()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<HistoryCategory>(categoryParam)
  const [formatFilter, setFormatFilter] = useState<GuideFormatFilter>('all')
  const [analyzerHistory, setAnalyzerHistory] = useState<ContentAnalyzerHistoryItem[]>([])

  useEffect(() => {
    setAnalyzerHistory(loadContentAnalyzerHistory())
  }, [])

  useEffect(() => {
    setCategory(categoryParam)
  }, [categoryParam])

  const filtered = useMemo(() => {
    const byFormat = formatFilter === 'all' ? items : items.filter((x) => x.category === formatFilter)
    const q = query.trim().toLowerCase()
    if (!q) return byFormat
    return byFormat.filter(
      (x) =>
        x.draft.title.toLowerCase().includes(q) ||
        x.publishTopic.toLowerCase().includes(q) ||
        x.draft.topic.toLowerCase().includes(q) ||
        x.draft.fullScript.toLowerCase().includes(q) ||
        x.polished?.fullContent.toLowerCase().includes(q),
    )
  }, [items, query, formatFilter])

  const formatCounts = useMemo(() => {
    const counts: Record<GuideFormatFilter, number> = { all: items.length, video: 0, writing: 0, image: 0 }
    for (const x of items) counts[x.category] += 1
    return counts
  }, [items])

  const switchCategory = (next: HistoryCategory) => {
    setCategory(next)
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'generation-history')
    if (next === 'analyzer') p.set('category', 'analyzer')
    else p.delete('category')
    router.replace(`${pathname}?${p.toString()}`)
  }

  const goToContentStudio = (item: GenerationHistoryItem) => {
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
    addToast('발행 편집 화면으로 이동합니다', 'success')
  }

  const openInGuide = (item: GenerationHistoryItem) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-guide')
    p.set('historyId', item.id)
    if (item.publishTopic) p.set('topic', item.publishTopic)
    router.push(`${pathname}?${p.toString()}`)
    addToast('콘텐츠 가이드에서 엽니다', 'success')
  }

  const handleRestoreAnalyzerItem = (item: ContentAnalyzerHistoryItem) => {
    const p = new URLSearchParams()
    p.set('view', 'content-analyzer')
    p.set('historyId', item.id)
    router.push(`${pathname}?${p.toString()}`)
    addToast('콘텐츠 분석기에서 불러옵니다', 'success')
  }

  const handleRemoveAnalyzerItem = (id: string) => {
    setAnalyzerHistory(removeContentAnalyzerHistoryItem(id))
  }

  const handleClearAnalyzerHistory = () => {
    clearContentAnalyzerHistory()
    setAnalyzerHistory([])
    addToast('분석 기록을 비웠습니다', 'info')
  }

  return (
    <PageLoadingOverlay loading={isLoading} label="생성 히스토리를 불러오는 중…">
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchCategory('guide')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              category === 'guide'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
            }`}
          >
            📝 콘텐츠 가이드 ({items.length})
          </button>
          <button
            type="button"
            onClick={() => switchCategory('analyzer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              category === 'analyzer'
                ? 'bg-pink-600 text-white'
                : 'bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
            }`}
          >
            🔍 콘텐츠 분석기 ({analyzerHistory.length})
          </button>
        </div>

        {category === 'guide' ? (
          <>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
                  전체 {items.length}건
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  >
                    ↻ 새로고침
                  </button>
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`히스토리 ${items.length}건을 모두 삭제할까요?`)) return
                        void clearAll().then(() => addToast('히스토리를 비웠습니다', 'info'))
                      }}
                      className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition"
                    >
                      전체 삭제
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {GUIDE_FORMAT_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormatFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      formatFilter === f.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f.label} ({formatCounts[f.id]})
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제목·주제·본문 검색…"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <GenerationHistoryList
              items={filtered}
              variant="page"
              initialExpandedId={highlightId}
              addToast={addToast}
              onRemove={removeItem}
              onGoToStudio={goToContentStudio}
              onLoadInGuide={openInGuide}
            />

            {!isLoading && filtered.length === 0 && items.length > 0 && (
              <p className="text-sm text-center text-slate-500 py-4">검색 조건에 맞는 항목이 없습니다.</p>
            )}
          </>
        ) : (
          <ContentAnalyzerHistorySection
            items={analyzerHistory}
            activeId={null}
            addToast={addToast}
            onRestore={handleRestoreAnalyzerItem}
            onRemove={handleRemoveAnalyzerItem}
            onClearAll={handleClearAnalyzerHistory}
            variant="page"
          />
        )}
      </div>
    </PageLoadingOverlay>
  )
}
