'use client'

import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { TopicGuideHistoryItem } from '@/lib/dashboard/topic-guide-history-types'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface TopicGuideHistorySectionProps {
  items: TopicGuideHistoryItem[]
  activeId: string | null
  isLoading?: boolean
  addToast: AddToast
  onRestore: (item: TopicGuideHistoryItem) => void
  onRemove: (id: string) => void | Promise<void>
  onClearAll: () => void | Promise<void>
}

export function TopicGuideHistorySection({
  items,
  activeId,
  isLoading = false,
  addToast,
  onRestore,
  onRemove,
  onClearAll,
}: TopicGuideHistorySectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 p-4">
        <p className="text-xs text-amber-700/80 text-center py-2">주제 가이드 기록 불러오는 중…</p>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleWithHint
          as="h4"
          className="text-xs font-bold text-amber-900 dark:text-amber-200"
          hint="입력 키워드 · AI 제안 목록 · 선택한 주제가 Supabase에 저장됩니다."
        >
          📋 주제 가이드 기록
          <span className="ml-1.5 font-normal text-amber-700/80">({items.length})</span>
        </TitleWithHint>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`주제 가이드 기록 ${items.length}건을 모두 삭제할까요?`)) return
            void Promise.resolve(onClearAll()).then(() => addToast('주제 가이드 기록을 비웠습니다', 'info'))
          }}
          className="text-[10px] text-amber-700/70 hover:text-red-600 transition"
        >
          전체 삭제
        </button>
      </div>

      <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.slice(0, 8).map((item) => {
          const expanded = expandedId === item.id
          const hasSelection = !!item.selectedSuggestion
          return (
            <li
              key={item.id}
              className={`rounded-lg border text-left transition ${
                activeId === item.id
                  ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30'
                  : 'border-amber-100 dark:border-amber-900/50 bg-white/80 dark:bg-gray-900/50'
              }`}
            >
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="flex-1 min-w-0 text-left px-3 py-2.5"
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">
                    🔑 {item.seedKeyword}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    제안 {item.suggestions.length}개
                    {hasSelection ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                        {' '}
                        · 선택: {item.selectedPublishTopic?.slice(0, 36)}
                        {(item.selectedPublishTopic?.length ?? 0) > 36 ? '…' : ''}
                      </span>
                    ) : (
                      <span className="text-amber-600"> · 미선택</span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(item.updatedAt).toLocaleString('ko-KR')}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  title="이 기록 불러오기"
                  className="shrink-0 px-2.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-l border-amber-100 dark:border-amber-900/50"
                >
                  불러오기
                </button>
                <button
                  type="button"
                  onClick={() => void Promise.resolve(onRemove(item.id))}
                  title="삭제"
                  className="shrink-0 px-2 text-gray-300 hover:text-red-500 border-l border-amber-100 dark:border-amber-900/50"
                >
                  ×
                </button>
              </div>

              {expanded && (
                <div className="px-3 pb-3 pt-0 border-t border-amber-100/80 dark:border-amber-900/40 space-y-1.5">
                  {item.suggestions.map((s) => {
                    const isSelected = item.selectedSuggestion?.id === s.id
                    return (
                      <div
                        key={s.id}
                        className={`rounded-md px-2 py-1.5 text-[11px] ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-indigo-300 dark:ring-indigo-700'
                            : 'bg-gray-50 dark:bg-gray-800/60'
                        }`}
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{s.title}</p>
                        {s.hook && <p className="text-gray-500 mt-0.5">{s.hook}</p>}
                        {isSelected && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                            ✓ 선택됨
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
