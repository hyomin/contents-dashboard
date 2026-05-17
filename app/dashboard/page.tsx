'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Video, Toast } from '@/lib/dashboard-types'
import { ToastContainer, VideoModal } from '@/components/dashboard/ToastContainer'
import BenchmarkViewComponent from '@/components/dashboard/BenchmarkView'
import TopicSuggestView from '@/components/dashboard/TopicSuggestView'
import OverviewView from '@/components/dashboard/views/OverviewView'
import PlatformView from '@/components/dashboard/views/PlatformView'
import OutlierView from '@/components/dashboard/views/OutlierView'
import TrendingView from '@/components/dashboard/views/TrendingView'
import AiInsightView from '@/components/dashboard/views/AiInsightView'
import CompetitorChannelsView from '@/components/dashboard/views/CompetitorChannelsView'
import MyChannelsView from '@/components/dashboard/views/MyChannelsView'
import CalendarView from '@/components/dashboard/views/CalendarView'
import DataCollectView from '@/components/dashboard/views/DataCollectView'
import RevenueView from '@/components/dashboard/views/RevenueView'
import RepurposeView from '@/components/dashboard/views/RepurposeView'
import DeployView from '@/components/dashboard/views/DeployView'

// ─── 뷰별 메타 ──────────────────────────────────────────────────
const VIEW_META: Record<string, { title: string; desc: string; filter?: string }> = {
  overview:            { title: '전체 개요',        desc: '모든 플랫폼의 콘텐츠 분석 현황' },
  youtube:             { title: 'YouTube',           desc: 'YouTube 콘텐츠 분석',            filter: 'youtube' },
  'youtube-shorts':    { title: 'YouTube Shorts',    desc: '숏폼 콘텐츠 분석',               filter: 'youtube' },
  'youtube-longform':  { title: 'YouTube 롱폼',      desc: '롱폼 콘텐츠 분석',               filter: 'youtube' },
  instagram:           { title: 'Instagram',         desc: 'Instagram 콘텐츠 분석',          filter: 'instagram' },
  'instagram-reels':   { title: 'Instagram Reels',   desc: 'Reels 분석',                     filter: 'instagram' },
  'instagram-carousel':{ title: '캐러셀 포스트',     desc: '캐러셀 분석',                    filter: 'instagram' },
  'naver-blog':        { title: '네이버 블로그',     desc: '네이버 블로그 분석',              filter: 'naver-blog' },
  tistory:             { title: '티스토리',           desc: '티스토리 분석',                  filter: 'tistory' },
  trending:            { title: '트렌딩 키워드',      desc: '급상승 키워드 및 트렌드' },
  outlier:             { title: 'Outlier 분석',       desc: 'vs.Avg 3.0x 이상 콘텐츠' },
  'ai-insight':        { title: 'AI 인사이트',        desc: 'AI 기반 콘텐츠 기획 추천' },
  benchmark:           { title: '벤치마킹 저장함',    desc: '분석용으로 저장한 콘텐츠 모음' },
  channels:            { title: '채널 관리',           desc: '경쟁 채널 및 내 채널 현황' },
  'channels-competitor': { title: '경쟁 채널 목록',   desc: '벤치마킹 대상 채널 관리' },
  'channels-mine':     { title: '내 채널',             desc: '내 채널 현황 및 목표' },
  calendar:            { title: '콘텐츠 캘린더',       desc: '콘텐츠 업로드 스케줄 관리' },
  pipeline:            { title: '파이프라인',           desc: '콘텐츠 생산 자동화 현황' },
  repurpose:           { title: 'Repurposing',          desc: 'Outlier 콘텐츠 멀티 플랫폼 재가공' },
  deploy:              { title: '배포 자동화',           desc: 'n8n 기반 멀티채널 자동 배포' },
  'data-collect':      { title: '데이터 수집',           desc: 'API 및 크롤링 수집 관리' },
  revenue:             { title: '수익 추적',             desc: '플랫폼별 수익 및 로드맵' },
  'topic-suggest':     { title: '주제 선별 AI',          desc: '레퍼런스 분석 기반 콘텐츠 주제 추천' },
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <span className="text-5xl mb-4">🚧</span>
      <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{title}</p>
      <p className="text-sm text-gray-400 mt-2">준비 중입니다. 곧 만나보실 수 있어요!</p>
    </div>
  )
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'overview'
  const meta = VIEW_META[view] ?? VIEW_META['overview']

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [counter, setCounter] = useState(0)

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = counter + 1
    setCounter(id)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const renderContent = () => {
    if (meta.filter) return <PlatformView filter={meta.filter} onSelect={setSelectedVideo} addToast={addToast} />
    switch (view) {
      case 'overview':             return <OverviewView onSelect={setSelectedVideo} addToast={addToast} />
      case 'outlier':              return <OutlierView onSelect={setSelectedVideo} addToast={addToast} />
      case 'trending':             return <TrendingView addToast={addToast} />
      case 'ai-insight':           return <AiInsightView addToast={addToast} />
      case 'benchmark':            return <BenchmarkViewComponent addToast={addToast} />
      case 'topic-suggest':        return <TopicSuggestView addToast={addToast} />
      case 'channels':
      case 'channels-competitor':  return <CompetitorChannelsView addToast={addToast} />
      case 'channels-mine':        return <MyChannelsView addToast={addToast} />
      case 'calendar':             return <CalendarView addToast={addToast} />
      case 'repurpose':            return <RepurposeView addToast={addToast} />
      case 'deploy':               return <DeployView addToast={addToast} />
      case 'data-collect':         return <DataCollectView addToast={addToast} />
      case 'revenue':              return <RevenueView addToast={addToast} />
      default:                     return <ComingSoon title={meta.title} />
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}

      <div className="p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{meta.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{meta.desc}</p>
        </div>
        {renderContent()}
      </div>
    </>
  )
}
