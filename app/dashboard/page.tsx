import { Suspense } from 'react'
import { DashboardPageContent, DashboardPageFallback } from '@/components/dashboard/DashboardPageContent'

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardPageContent />
    </Suspense>
  )
}
