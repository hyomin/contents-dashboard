/**
 * 대시보드 공통 로딩 UI
 *
 * PageLoadingOverlay  - API 데이터 수신 중 전체 딤 + 인터랙션 차단
 * Spinner             - 범용 스피너
 * CardRunningBadge    - n8n / 액션 카드 내 실행 중 배지
 * CardLoadingShell    - 카드 자체를 dim + 인터랙션 차단 (카드 단위 액션)
 */

import { type ReactNode } from 'react'

// ─── Spinner ────────────────────────────────────────────────────────────────

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE: Record<SpinnerSize, string> = {
  sm: 'w-3.5 h-3.5 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-12 h-12 border-4',
}

export function Spinner({
  size = 'md',
  className = '',
  color = 'border-blue-600',
}: {
  size?: SpinnerSize
  className?: string
  color?: string
}) {
  return (
    <span
      className={`inline-block rounded-full border-transparent ${SIZE[size]} ${color} border-t-current animate-spin ${className}`}
      aria-label="로딩 중"
    />
  )
}

// ─── PageLoadingOverlay ─────────────────────────────────────────────────────
// 뷰 전체를 덮어 인터랙션을 차단합니다.

export function PageLoadingOverlay({
  loading,
  label = '데이터를 불러오는 중…',
  children,
}: {
  loading: boolean
  label?: string
  children: ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div
          className="absolute inset-0 z-30 rounded-2xl bg-white/75 dark:bg-gray-950/75 backdrop-blur-[3px] flex items-center justify-center"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 px-7 py-5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
            <Spinner size="xl" color="border-blue-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">{label}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CardLoadingShell ────────────────────────────────────────────────────────
// 카드(또는 섹션) 단위 액션 진행 중 딤.
// 페이지 딤이 아닌, 특정 카드만 차단할 때 사용합니다.

export function CardLoadingShell({
  loading,
  label,
  children,
  className = '',
}: {
  loading: boolean
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {loading && (
        <div className="absolute inset-0 z-10 rounded-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700">
            <Spinner size="sm" color="border-blue-500" />
            {label && <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CardRunningBadge ────────────────────────────────────────────────────────
// n8n 카드에서 실행 중 / 완료 / 실패 상태를 인라인 배지로 표시합니다.

export type RunState = 'idle' | 'running' | 'done' | 'error'

export function CardRunningBadge({ state, label }: { state: RunState; label?: string }) {
  if (state === 'idle') return null

  const styles: Record<Exclude<RunState, 'idle'>, string> = {
    running: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    done:    'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    error:   'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  }

  const icons: Record<Exclude<RunState, 'idle'>, ReactNode> = {
    running: <Spinner size="sm" color="border-blue-500" />,
    done:    <span>✓</span>,
    error:   <span>✕</span>,
  }

  const defaultLabels: Record<Exclude<RunState, 'idle'>, string> = {
    running: '실행 중…',
    done:    '완료',
    error:   '실패',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${styles[state]}`}
    >
      {icons[state]}
      {label ?? defaultLabels[state]}
    </span>
  )
}

// ─── 카드 전체 강조 테두리 (실행 중 펄스) ───────────────────────────────────
// n8n 카드가 running 상태일 때 외곽 테두리가 파랗게 펄스됩니다.

export function runningRingClass(state: RunState): string {
  return state === 'running'
    ? 'ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-1 dark:ring-offset-gray-900 animate-pulse'
    : ''
}
