'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Video, Toast, ToastKind } from '@/lib/dashboard/dashboard-types'
import { ToastContainer, VideoModal } from '@/components/dashboard/ToastContainer'
import {
  loadNotificationSettings,
  shouldShowToast,
} from '@/lib/dashboard/notification-settings'
import { resolveViewMeta } from '@/lib/dashboard/dashboard-nav'
import { PageHeader } from '@/components/dashboard/info-hint'

// ─── 뷰 로딩 중 폴백 ──────────────────────────────────────────────
function ViewFallback() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  )
}

// ─── Lazy-loaded 뷰 (초기 번들에서 분리) ──────────────────────────
const OverviewView = dynamic(
  () => import('@/components/dashboard/views/OverviewView'),
  { loading: ViewFallback },
)
const PlatformView = dynamic(
  () => import('@/components/dashboard/views/PlatformView'),
  { loading: ViewFallback },
)
const AnalysisHubView = dynamic(
  () => import('@/components/dashboard/views/AnalysisHubView').then(m => ({ default: m.AnalysisHubView })),
  { loading: ViewFallback },
)
const OutlierView = dynamic(
  () => import('@/components/dashboard/views/OutlierView'),
  { loading: ViewFallback },
)
const TrendingView = dynamic(
  () => import('@/components/dashboard/views/TrendingView'),
  { loading: ViewFallback },
)
const AiInsightView = dynamic(
  () => import('@/components/dashboard/views/AiInsightView'),
  { loading: ViewFallback },
)
const MyChannelsView = dynamic(
  () => import('@/components/dashboard/views/MyChannelsView'),
  { loading: ViewFallback },
)
const CalendarView = dynamic(
  () => import('@/components/dashboard/views/CalendarView'),
  { loading: ViewFallback },
)
const DataCollectView = dynamic(
  () => import('@/components/dashboard/views/DataCollectView'),
  { loading: ViewFallback },
)
const RevenueView = dynamic(
  () => import('@/components/dashboard/views/RevenueView'),
  { loading: ViewFallback },
)
const RepurposeView = dynamic(
  () => import('@/components/dashboard/views/RepurposeView'),
  { loading: ViewFallback },
)
const DeployView = dynamic(
  () => import('@/components/dashboard/views/DeployView'),
  { loading: ViewFallback },
)
const AutomationView = dynamic(
  () => import('@/components/dashboard/views/AutomationView'),
  { loading: ViewFallback },
)
const Lv1AutomationHubView = dynamic(
  () => import('@/components/dashboard/views/Lv1AutomationHubView'),
  { loading: ViewFallback },
)
const SettingsView = dynamic(
  () => import('@/components/dashboard/views/SettingsView'),
  { loading: ViewFallback },
)
const ContentCreationGuideView = dynamic(
  () => import('@/components/dashboard/views/ContentCreationGuideView'),
  { loading: ViewFallback },
)
const ContentAnalyzerView = dynamic(
  () => import('@/components/dashboard/views/ContentAnalyzerView'),
  { loading: ViewFallback },
)
const ProductionTrackerView = dynamic(
  () => import('@/components/dashboard/views/ProductionTrackerView'),
  { loading: ViewFallback },
)
const ContentStudioView = dynamic(
  () => import('@/components/dashboard/views/ContentStudioView'),
  { loading: ViewFallback },
)
const GenerationHistoryView = dynamic(
  () => import('@/components/dashboard/views/GenerationHistoryView'),
  { loading: ViewFallback },
)
const BenchmarkViewComponent = dynamic(
  () => import('@/components/dashboard/BenchmarkView'),
  { loading: ViewFallback },
)
const TopicSuggestView = dynamic(
  () => import('@/components/dashboard/TopicSuggestView'),
  { loading: ViewFallback },
)

// ─────────────────────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <span className="text-5xl mb-4">🚧</span>
      <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{title}</p>
      <p className="text-sm text-gray-400 mt-2">준비 중입니다. 곧 만나보실 수 있어요!</p>
    </div>
  )
}

export function DashboardPageContent() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'overview'
  const meta = resolveViewMeta(view)

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastDismissMs, setToastDismissMs] = useState(4500)
  const toastIdRef = useRef(0)

  useEffect(() => {
    function syncToastSettings() {
      setToastDismissMs(loadNotificationSettings().toastDurationMs)
    }
    syncToastSettings()
    window.addEventListener('dashboard-settings-changed', syncToastSettings)
    window.addEventListener('storage', syncToastSettings)
    return () => {
      window.removeEventListener('dashboard-settings-changed', syncToastSettings)
      window.removeEventListener('storage', syncToastSettings)
    }
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', kind: ToastKind = 'general') => {
    const settings = loadNotificationSettings()
    if (!shouldShowToast(settings, type, kind)) return
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const renderContent = () => {
    if (meta.filter) {
      return (
        <PlatformView
          filter={meta.filter}
          videoFormat={meta.videoFormat}
          mineOnly={meta.mineOnly}
          onSelect={setSelectedVideo}
          addToast={addToast}
        />
      )
    }
    switch (view) {
      case 'analysis':             return <AnalysisHubView onSelect={setSelectedVideo} addToast={addToast} />
      case 'overview':             return <OverviewView onSelect={setSelectedVideo} addToast={addToast} />
      case 'outlier':              return <OutlierView onSelect={setSelectedVideo} addToast={addToast} />
      case 'trending':             return <TrendingView addToast={addToast} />
      case 'ai-insight':           return <AiInsightView addToast={addToast} />
      case 'benchmark':            return <BenchmarkViewComponent addToast={addToast} />
      case 'topic-suggest':        return <TopicSuggestView addToast={addToast} />
      case 'my-channels':
      case 'channels-mine':        return <MyChannelsView addToast={addToast} />
      case 'calendar':             return <CalendarView addToast={addToast} />
      case 'repurpose':            return <RepurposeView addToast={addToast} />
      case 'deploy':               return <DeployView addToast={addToast} />
      case 'data-collect':         return <DataCollectView addToast={addToast} />
      case 'automation':
      case 'n8n-execute':          return <AutomationView addToast={addToast} />
      case 'n8n-lv1':              return <Lv1AutomationHubView addToast={addToast} />
      case 'revenue':              return <RevenueView addToast={addToast} />
      case 'content-guide':        return <ContentCreationGuideView addToast={addToast} />
      case 'content-analyzer':     return <ContentAnalyzerView addToast={addToast} />
      case 'production-tracker':   return <ProductionTrackerView addToast={addToast} />
      case 'content-studio':       return <ContentStudioView addToast={addToast} />
      case 'generation-history':   return <GenerationHistoryView addToast={addToast} />
      case 'settings':             return <SettingsView addToast={addToast} />
      default:                     return <ComingSoon title={meta.title} />
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} dismissMs={toastDismissMs} />
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          addToast={addToast}
        />
      )}

      <div className="p-6 md:p-8">
        <PageHeader title={meta.title} description={meta.desc} />
        {renderContent()}
      </div>
    </>
  )
}

function DashboardPageFallback() {
  return (
    <div className="p-6 md:p-8 animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
    </div>
  )
}

export { DashboardPageFallback }
