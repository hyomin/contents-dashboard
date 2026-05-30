'use client'

import { useMemo, useState } from 'react'
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
import { PageLoadingOverlay } from '@/components/dashboard/ui/loading'

type FilterKind = 'all' | 'polished' | 'draft-only'

export default function GenerationHistoryView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('id')

  const { items, isLoading, removeItem, clearAll, reload } = useGenerationHistory()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKind>('all')

  const filtered = useMemo(() => {
    let list = items
    if (filter === 'polished') list = list.filter((x) => x.polished)
    if (filter === 'draft-only') list = list.filter((x) => !x.polished)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (x) =>
        x.draft.title.toLowerCase().includes(q) ||
        x.publishTopic.toLowerCase().includes(q) ||
        x.draft.topic.toLowerCase().includes(q) ||
        x.draft.fullScript.toLowerCase().includes(q) ||
        x.polished?.fullContent.toLowerCase().includes(q),
    )
  }, [items, filter, query])

  const stats = useMemo(
    () => ({
      total: items.length,
      polished: items.filter((x) => x.polished).length,
      draftOnly: items.filter((x) => !x.polished).length,
    }),
    [items],
  )

  const goToContentStudio = (item: GenerationHistoryItem, usePolished: boolean) => {
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

  const openInGuide = (item: GenerationHistoryItem, view: 'draft' | 'polished') => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-guide')
    p.set('historyId', item.id)
    p.set('historyView', view)
    if (item.publishTopic) p.set('topic', item.publishTopic)
    router.push(`${pathname}?${p.toString()}`)
    addToast('콘텐츠 가이드에서 엽니다', 'success')
  }

  return (
    <PageLoadingOverlay loading={isLoading} label="생성 히스토리를 불러오는 중…">
      <div className="space-y-6 max-w-4xl">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                전체 {stats.total}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium">
                내 콘텐츠화 {stats.polished}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 font-medium">
                원본만 {stats.draftOnly}
              </span>
            </div>
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

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목·주제·본문 검색…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', `전체 (${stats.total})`],
                ['polished', `내 콘텐츠화 (${stats.polished})`],
                ['draft-only', `원본만 (${stats.draftOnly})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filter === id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
          <p className="text-sm text-center text-slate-500 py-4">검색·필터 조건에 맞는 항목이 없습니다.</p>
        )}
      </div>
    </PageLoadingOverlay>
  )
}
