'use client'

import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { ContentAnalyzerHistoryItem } from '@/lib/dashboard/content-analyzer-history'
import { TitleWithHint } from '@/components/dashboard/info-hint'

const PLATFORM_ICON: Record<ContentAnalyzerHistoryItem['platform'], string> = {
  youtube: '🔴',
  instagram: '💗',
  tiktok: '⚫',
  unknown: '🔗',
}

interface ContentAnalyzerHistorySectionProps {
  items: ContentAnalyzerHistoryItem[]
  activeId: string | null
  addToast: AddToast
  onRestore: (item: ContentAnalyzerHistoryItem) => void
  onRemove: (id: string) => void
  onClearAll: () => void
  /** 'embedded': 분석기 화면 내 미리보기 (최대 8건) · 'page': 히스토리 관리 전체 목록 */
  variant?: 'embedded' | 'page'
}

export function ContentAnalyzerHistorySection({
  items,
  activeId,
  addToast,
  onRestore,
  onRemove,
  onClearAll,
  variant = 'embedded',
}: ContentAnalyzerHistorySectionProps) {
  const isPage = variant === 'page'
  if (items.length === 0) {
    return isPage ? (
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">
        저장된 분석 기록이 없습니다. «콘텐츠 분석기»에서 URL을 분석하면 여기에 쌓입니다.
      </p>
    ) : null
  }

  return (
    <div
      className={`rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 space-y-3 ${
        isPage ? 'p-5' : 'p-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleWithHint
          as="h4"
          className="text-xs font-bold text-amber-900 dark:text-amber-200"
          hint="이전에 분석했던 콘텐츠 기록입니다. 카드를 클릭하면 그때의 분석 결과를 다시 불러옵니다 (AI를 재호출하지 않습니다)."
        >
          🕘 콘텐츠 분석기 기록
          <span className="ml-1.5 font-normal text-amber-700/80">({items.length})</span>
        </TitleWithHint>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`분석 기록 ${items.length}건을 모두 삭제할까요?`)) return
            onClearAll()
            addToast('분석 기록을 비웠습니다', 'info')
          }}
          className="text-[10px] text-amber-700/70 hover:text-red-600 transition"
        >
          전체 삭제
        </button>
      </div>

      <ul className={`space-y-2 overflow-y-auto pr-1 ${isPage ? 'max-h-[min(70vh,640px)]' : 'max-h-64'}`}>
        {(isPage ? items : items.slice(0, 8)).map((item) => (
          <li
            key={item.id}
            className={`flex items-stretch gap-1 rounded-lg border text-left transition ${
              activeId === item.id
                ? 'border-pink-400 bg-pink-50/60 dark:bg-pink-950/30'
                : 'border-amber-100 dark:border-amber-900/50 bg-white/80 dark:bg-gray-900/50 hover:border-pink-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onRestore(item)}
              title="클릭하면 이때 분석했던 결과를 다시 불러옵니다"
              className="flex-1 min-w-0 text-left px-3 py-2.5"
            >
              <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">
                {PLATFORM_ICON[item.platform]} {item.url}
              </p>
              <p className="text-[10px] mt-0.5 text-gray-400 line-clamp-1">
                {item.result.targetEmotion.keywords.slice(0, 3).map((k) => `#${k}`).join(' ')}
                {item.result.targetEmotion.keywords.length > 0 ? ' · ' : ''}
                {new Date(item.createdAt).toLocaleString('ko-KR')}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              title="이 기록 삭제"
              className="shrink-0 px-2 text-gray-300 hover:text-red-500 border-l border-amber-100 dark:border-amber-900/50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-amber-700/60 -mt-1">
        {isPage
          ? '카드를 클릭하면 «콘텐츠 분석기»에서 그때의 분석 결과를 다시 불러옵니다 (AI 재호출 없음).'
          : '카드를 클릭하면 그때 분석했던 결과를 다시 불러옵니다.'}
      </p>
    </div>
  )
}
