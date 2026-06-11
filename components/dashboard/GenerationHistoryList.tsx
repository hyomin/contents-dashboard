'use client'

import { useMemo, useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { GenerationHistoryItem } from '@/lib/dashboard/generation-history-types'
import { FORMAT_META } from '@/components/dashboard/views/ContentStudioView'
import { getPlatformName } from '@/lib/dashboard/dashboard-helpers'

export type GenerationHistoryListVariant = 'embedded' | 'page'

interface GenerationHistoryListProps {
  items: GenerationHistoryItem[]
  variant?: GenerationHistoryListVariant
  activeId?: string | null
  addToast: AddToast
  onRemove: (id: string) => void | Promise<void>
  onGoToStudio: (item: GenerationHistoryItem) => void
  onLoadInGuide?: (item: GenerationHistoryItem) => void
  initialExpandedId?: string | null
}

function formatDate(iso: string, long = false): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', long
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  writing: '글쓰기',
  image: '이미지',
  video: '영상',
}

export function GenerationHistoryList({
  items,
  variant = 'embedded',
  activeId = null,
  addToast,
  onRemove,
  onGoToStudio,
  onLoadInGuide,
  initialExpandedId = null,
}: GenerationHistoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId)

  const isPage = variant === 'page'
  const previewMaxH = isPage ? 'max-h-[min(70vh,640px)]' : 'max-h-64'

  const bodyOf = (item: GenerationHistoryItem) => item.polished?.fullContent ?? item.draft.fullScript
  const bodyLen = (item: GenerationHistoryItem) => bodyOf(item).trim().length

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [items],
  )

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">
        {isPage
          ? '저장된 생성 기록이 없습니다. «콘텐츠 가이드»에서 스크립트를 생성하면 여기에 쌓입니다.'
          : '아직 저장된 생성 기록이 없습니다.'}
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {sorted.map((item) => {
        const isExpanded = expandedId === item.id
        const isActive = activeId === item.id
        const title = item.polished?.title ?? item.draft.title

        return (
          <li
            key={item.id}
            className={`rounded-xl border overflow-hidden transition ${
              isActive
                ? 'border-indigo-400 dark:border-indigo-600 ring-1 ring-indigo-200 dark:ring-indigo-800'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold text-gray-900 dark:text-white line-clamp-1 ${isPage ? 'text-base' : 'text-sm'}`}>
                    {title}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {item.publishTopic || item.draft.topic}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
                      본문 {bodyLen(item) > 0 ? `${bodyLen(item).toLocaleString()}자` : '없음'}
                      {item.polished && item.polished.imageGuideCount > 0 ? ` · 📷${item.polished.imageGuideCount}` : ''}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {FORMAT_META[item.draft.targetFormat]?.label ?? item.draft.targetFormat}
                    </span>
                    {item.referenceCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                        레퍼런스 {item.referenceCount}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-slate-400">{formatDate(item.updatedAt, isPage)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{isExpanded ? '▲' : '▼'}</p>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
                {bodyLen(item) === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                    저장된 본문이 비어 있습니다. «스크립트 가이드 생성» 직후 Supabase 저장이 실패했을 수 있습니다.
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  {item.draft.mode === 'n8n' ? 'n8n Gemini' : '대시보드 AI'} · {getPlatformName(item.draft.platform)} ·{' '}
                  {formatDate(item.polished?.polishedAt ?? item.draft.generatedAt, true)}
                </p>

                {item.referenceTitles.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-violet-600 dark:text-violet-400">참고 레퍼런스:</span>{' '}
                    {item.referenceTitles.slice(0, 3).join(' · ')}
                    {item.referenceTitles.length > 3 ? ` 외 ${item.referenceTitles.length - 3}건` : ''}
                  </div>
                )}

                {item.draft.hook && (
                  <div className="rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 px-3 py-2">
                    <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 mb-1">오프닝 훅</p>
                    <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{item.draft.hook}</p>
                  </div>
                )}

                {item.polished?.summary && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
                    {item.polished.summary}
                  </p>
                )}

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-3 py-1.5 bg-slate-100 dark:bg-gray-800 flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">본문</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(bodyOf(item))
                        addToast('복사되었습니다', 'success')
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      복사
                    </button>
                  </div>
                  <pre
                    className={`p-3 text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed overflow-y-auto ${previewMaxH} ${isPage ? 'text-sm' : 'text-xs'}`}
                  >
                    {bodyOf(item)}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  {onLoadInGuide && (
                    <button
                      type="button"
                      onClick={() => onLoadInGuide(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                      {isPage ? '콘텐츠 가이드에서 열기' : '결과 영역에 불러오기'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onGoToStudio(item)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition"
                  >
                    발행 편집 →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void Promise.resolve(onRemove(item.id)).then(() => {
                        if (expandedId === item.id) setExpandedId(null)
                        addToast('히스토리에서 삭제했습니다', 'info')
                      })
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition ml-auto"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
