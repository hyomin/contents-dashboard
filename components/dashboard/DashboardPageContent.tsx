'use client'

import { useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Video, Toast } from '@/lib/dashboard/dashboard-types'
import { ToastContainer, VideoModal } from '@/components/dashboard/ToastContainer'
import BenchmarkViewComponent from '@/components/dashboard/BenchmarkView'
import TopicSuggestView from '@/components/dashboard/TopicSuggestView'
import {
  OverviewView,
  PlatformView,
  OutlierView,
  TrendingView,
  AiInsightView,
  MyChannelsView,
  CalendarView,
  DataCollectView,
  RevenueView,
  RepurposeView,
  DeployView,
  AutomationView,
  SettingsView,
  ContentCreationGuideView,
  ContentStudioView,
  Lv1AutomationHubView,
  AnalysisHubView,
} from '@/components/dashboard/views'
import { resolveViewMeta } from '@/lib/dashboard/dashboard-nav'
import { PageHeader } from '@/components/dashboard/info-hint'

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
  const toastIdRef = useRef(0)

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
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
      case 'content-studio':       return <ContentStudioView addToast={addToast} />
      case 'settings':             return <SettingsView addToast={addToast} />
      default:                     return <ComingSoon title={meta.title} />
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} dismissMs={4500} />
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
