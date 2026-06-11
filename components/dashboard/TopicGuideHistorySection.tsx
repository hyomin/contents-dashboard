'use client'

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
          hint="이전에 조회했던 주제 가이드 검색 기록입니다. 결과를 다시 보고 싶다면 카드를 클릭해 그때의 제안 목록을 다시 불러오세요."
        >
          🕘 이전 검색 기록
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
          const hasSelection = !!item.selectedSuggestion
          return (
            <li
              key={item.id}
              className={`flex items-stretch gap-1 rounded-lg border text-left transition ${
                activeId === item.id
                  ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30'
                  : 'border-amber-100 dark:border-amber-900/50 bg-white/80 dark:bg-gray-900/50 hover:border-indigo-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onRestore(item)}
                title="클릭하면 이때 조회했던 제안 목록을 다시 불러옵니다"
                className="flex-1 min-w-0 text-left px-3 py-2.5"
              >
                <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">
                  🔑 {item.seedKeyword}
                  <span className="ml-1.5 font-normal text-gray-400">· 제안 {item.suggestions.length}개</span>
                </p>
                <p className="text-[10px] mt-0.5">
                  {hasSelection ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      ✓ 선택: {item.selectedPublishTopic?.slice(0, 36)}
                      {(item.selectedPublishTopic?.length ?? 0) > 36 ? '…' : ''}
                    </span>
                  ) : (
                    <span className="text-amber-600">미선택</span>
                  )}
                  <span className="text-gray-400"> · {new Date(item.updatedAt).toLocaleString('ko-KR')}</span>
                </p>
              </button>
              <button
                type="button"
                onClick={() => void Promise.resolve(onRemove(item.id))}
                title="이 기록 삭제"
                className="shrink-0 px-2 text-gray-300 hover:text-red-500 border-l border-amber-100 dark:border-amber-900/50"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-amber-700/60 -mt-1">카드를 클릭하면 그때 조회했던 제안 목록을 다시 불러옵니다.</p>
    </div>
  )
}
