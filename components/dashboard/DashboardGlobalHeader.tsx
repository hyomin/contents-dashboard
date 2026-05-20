'use client'

import { InfoHint } from '@/components/dashboard/info-hint'

interface DashboardGlobalHeaderProps {
  onOpenMobileMenu?: () => void
  showMobileMenu?: boolean
}

export function DashboardGlobalHeader({
  onOpenMobileMenu,
  showMobileMenu,
}: DashboardGlobalHeaderProps) {
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
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate inline-flex items-center gap-1.5">
            Contents Dashboard
            <InfoHint
              className="hidden sm:inline-flex"
              text="콘텐츠 분석·내 채널·n8n 워크플로를 한곳에서 관리합니다. n8n 실행은 «워크플로 관리»에서 Webhook으로 진행합니다."
            />
          </p>
        </div>
      </div>
    </header>
  )
}
