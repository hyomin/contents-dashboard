'use client'

import { useSessionActivity } from '@/components/auth/session-activity-provider'
import { SESSION_IDLE_MS } from '@/lib/auth/constants'

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getUrgencyClass(remainingMs: number): string {
  if (remainingMs <= 60_000) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
  }
  if (remainingMs <= 120_000) {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
  }
  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-200'
}

export function SessionIdleCountdown() {
  const { remainingMs } = useSessionActivity()
  const progress = Math.min(100, (remainingMs / SESSION_IDLE_MS) * 100)

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums ${getUrgencyClass(remainingMs)}`}
      title="마우스·키보드 등 활동이 없으면 자동 로그아웃됩니다"
      aria-live="polite"
      aria-label={`자동 로그아웃까지 ${formatCountdown(remainingMs)}`}
    >
      <span className="hidden sm:inline text-[11px] opacity-80">액션</span>
      <span className="relative flex h-2 w-14 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <span
          className="h-full rounded-full bg-current transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </span>
      <span className="min-w-[2.5rem] text-right">{formatCountdown(remainingMs)}</span>
    </div>
  )
}
