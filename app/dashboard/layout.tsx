import { Suspense } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Suspense fallback={
        <aside className="w-56 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />
      }>
        <Sidebar />
      </Suspense>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
