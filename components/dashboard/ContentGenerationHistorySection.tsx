'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { GenerationHistoryItem } from '@/lib/dashboard/generation-history-types'
import { GenerationHistoryList } from '@/components/dashboard/GenerationHistoryList'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface ContentGenerationHistorySectionProps {
  items: GenerationHistoryItem[]
  activeId: string | null
  isLoading?: boolean
  addToast: AddToast
  onLoad: (item: GenerationHistoryItem) => void
  onRemove: (id: string) => void | Promise<void>
  onClearAll: () => void | Promise<void>
  onGoToStudio: (item: GenerationHistoryItem) => void
}

export function ContentGenerationHistorySection({
  items,
  activeId,
  isLoading = false,
  addToast,
  onLoad,
  onRemove,
  onClearAll,
  onGoToStudio,
}: ContentGenerationHistorySectionProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const historyHref = (() => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'generation-history')
    return `${pathname}?${p.toString()}`
  })()

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/20 p-6">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">📚 최근 생성 기록</h3>
        <p className="text-xs text-slate-500 text-center py-4">Supabase에서 불러오는 중…</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TitleWithHint
          as="h3"
          className="text-lg font-bold text-slate-900 dark:text-slate-100"
          hint="최근 생성 기록입니다. 전체 목록·검색은 «히스토리 관리» 메뉴에서 확인하세요."
        >
          📚 최근 생성 기록
          {items.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">({items.length})</span>
          )}
        </TitleWithHint>
        <div className="flex items-center gap-3 shrink-0">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`히스토리 ${items.length}건을 모두 삭제할까요?`)) return
                void Promise.resolve(onClearAll()).then(() => addToast('히스토리를 비웠습니다', 'info'))
              }}
              className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              전체 삭제
            </button>
          )}
          <Link
            href={historyHref}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            히스토리 관리 →
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
          아직 저장된 기록이 없습니다. «스크립트 가이드 생성» 후 Supabase에 자동 저장됩니다.
        </p>
      ) : (
        <GenerationHistoryList
          items={items.slice(0, 5)}
          variant="embedded"
          activeId={activeId}
          addToast={addToast}
          onRemove={onRemove}
          onGoToStudio={onGoToStudio}
          onLoadInGuide={onLoad}
        />
      )}

      {items.length > 5 && (
        <Link
          href={historyHref}
          className="block text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline py-1"
        >
          이전 기록 {items.length - 5}건 더 보기 →
        </Link>
      )}
    </section>
  )
}
