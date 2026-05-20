'use client'

import { useState, Suspense } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import { DashboardGlobalHeader } from '@/components/dashboard/DashboardGlobalHeader'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 */}
      <div className={`
        fixed lg:relative z-40 lg:z-auto h-full
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Suspense fallback={
          <aside className="w-56 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />
        }>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </Suspense>
      </div>

      {/* 메인: 전역 헤더 + 스크롤 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashboardGlobalHeader onOpenMobileMenu={() => setSidebarOpen(true)} showMobileMenu />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
