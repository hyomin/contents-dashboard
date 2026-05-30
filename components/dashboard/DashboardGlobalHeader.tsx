'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SessionIdleCountdown } from '@/components/auth/session-idle-countdown'
import { InfoHint } from '@/components/dashboard/info-hint'

interface DashboardGlobalHeaderProps {
  onOpenMobileMenu?: () => void
  showMobileMenu?: boolean
}

export function DashboardGlobalHeader({
  onOpenMobileMenu,
  showMobileMenu,
}: DashboardGlobalHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeView = searchParams.get('view') ?? 'overview'
  const isSettings = activeView === 'settings'

  function goOverview() {
    router.push(`${pathname}?view=overview`)
  }

  function goSettings() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'settings')
    router.push(`${pathname}?${params.toString()}`)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    router.replace('/login')
    router.refresh()
  }

  return (
    <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        {showMobileMenu && onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={goOverview}
            title="대시보드 홈"
            className="min-w-0 text-left rounded-lg px-1 py-0.5 -mx-1 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition"
          >
            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
              Contents Dashboard
            </span>
          </button>
          <InfoHint
            className="hidden sm:inline-flex"
            text="콘텐츠 분석·내 채널·n8n 워크플로를 한곳에서 관리합니다. 로고를 클릭하면 홈(개요)으로 이동합니다."
          />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={goSettings}
          aria-current={isSettings ? 'page' : undefined}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition
            ${isSettings
              ? 'bg-blue-600 text-white shadow-sm'
              : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
        >
          <svg
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">설정</span>
        </button>
        <SessionIdleCountdown />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
