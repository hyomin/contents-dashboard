'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Video, AddToast } from '@/lib/dashboard/dashboard-types'
import type { DataInsight, TrendingKeyword } from '@/lib/data/analytics-from-videos'
import { getTierColor, formatViews, dbVideoToVideo } from '@/lib/dashboard/dashboard-helpers'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo, DBChannel } from '@/lib/data/supabase'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import type { InsightSection } from '@/app/api/dashboard/insights/route'
import { PageLoadingOverlay, Spinner } from '@/components/dashboard/ui/loading'
import { usePlanningQueue } from '@/lib/hooks/use-planning-queue'

interface VideoStats {
  total: number
  byPlatform: Record<string, number>
  byTier: Record<string, number>
  avgVsAvg: number
}

function InsightActionCard({
  ins,
  onAdd,
  onGoGuide,
}: {
  ins: DataInsight
  onAdd: (ins: DataInsight) => void
  onGoGuide: (ins: DataInsight) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAdd(ins)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd(ins)
        }
      }}
      className="relative bg-white/10 hover:bg-white/20 rounded-xl p-3 flex gap-3 items-start cursor-pointer transition group"
    >
      <span className="text-xl shrink-0">{ins.icon}</span>
      <div className="flex-1 min-w-0 pr-16">
        <p className="text-sm leading-relaxed">{ins.text}</p>
      </div>

      {/* hover 플로팅 액션 */}
      <div
        className="absolute top-2 right-2 flex gap-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onAdd(ins)}
          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white/95 text-indigo-700 shadow-md hover:bg-white hover:scale-105 transition"
        >
          + 기획
        </button>
        <button
          type="button"
          onClick={() => onGoGuide(ins)}
          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-900/90 text-white shadow-md hover:bg-indigo-950 hover:scale-105 transition"
        >
          가이드 →
        </button>
      </div>
    </div>
  )
}

export default function OverviewView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [stats, setStats] = useState<VideoStats | null>(null)
  const [outlierVideos, setOutlierVideos] = useState<Video[]>([])
  const [allVideos, setAllVideos] = useState<Video[]>([])
  const [channels, setChannels] = useState<DBChannel[]>([])
  const [insights, setInsights] = useState<DataInsight[]>([])
  const [insightSubtitle, setInsightSubtitle] = useState('')
  const [activeKeywords, setActiveKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [trending, setTrending] = useState<TrendingKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const { addItem: addToQueue } = usePlanningQueue()

  const handleAddInsight = useCallback(
    (ins: DataInsight, silent = false) => {
      const added = addToQueue(ins.text.slice(0, 80), 'insight', { detail: ins.text, icon: ins.icon })
      if (!silent) {
        addToast(
          added
            ? '기획 큐에 추가됨 ✓'
            : '이미 기획 큐에 있는 항목입니다',
          added ? 'success' : 'warning',
        )
      }
      return added
    },
    [addToQueue, addToast],
  )

  const goToContentGuide = useCallback(
    (ins: DataInsight) => {
      handleAddInsight(ins, true)
      const p = new URLSearchParams(searchParams.toString())
      p.set('view', 'content-guide')
      const topicText = ins.text.trim().slice(0, 120)
      if (topicText) p.set('topic', topicText)
      router.push(`${pathname}?${p.toString()}`)
      addToast('콘텐츠 가이드로 이동합니다', 'success')
    },
    [handleAddInsight, router, pathname, searchParams, addToast],
  )

  const loadInsights = useCallback(
    (keywords?: string[], bust = false) => {
      setInsightsLoading(true)
      const params = new URLSearchParams()
      if (bust) params.set('bust', '1')
      if (keywords && keywords.length > 0) params.set('keywords', keywords.join(','))

      fetch(`/api/dashboard/insights?${params}`)
        .then((r) => r.json())
        .then((d: { sections?: InsightSection[]; scoped?: boolean; keywords?: string[] }) => {
          const personal = d.sections?.find((s) => s.type === 'personal')
          setInsights(personal?.items ?? [])
          setInsightSubtitle(personal?.subtitle ?? '')
          if (d.scoped && d.keywords?.length) {
            setActiveKeywords(d.keywords)
          } else if (!keywords?.length) {
            setActiveKeywords([])
          }
        })
        .catch(() => addToast('인사이트 로드 실패', 'warning'))
        .finally(() => setInsightsLoading(false))

      fetch('/api/dashboard/trending')
        .then((r) => r.json())
        .then((d: { keywords?: TrendingKeyword[] }) => setTrending(d.keywords ?? []))
        .catch(console.error)
    },
    [addToast],
  )

  const handleKeywordSearch = () => {
    const parsed = keywordInput
      .split(/[,，\s]+/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 5)
    if (parsed.length === 0) {
      addToast('키워드를 1개 이상 입력하세요', 'warning')
      return
    }
    setActiveKeywords(parsed)
    loadInsights(parsed, true)
  }

  const clearKeywordScope = () => {
    setKeywordInput('')
    setActiveKeywords([])
    loadInsights(undefined, true)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/videos?type=stats').then(r => r.json()),
      fetch('/api/dashboard/videos?type=outliers&limit=10').then(r => r.json()),
      fetch('/api/dashboard/videos?limit=100').then(r => r.json()),
      fetch('/api/dashboard/channels').then(r => r.json()),
    ]).then(([statsData, outliersData, allData, channelsData]) => {
      setStats(statsData)
      setOutlierVideos((outliersData as DBVideo[]).map(dbVideoToVideo))
      setAllVideos((allData as DBVideo[]).map(dbVideoToVideo))
      setChannels(channelsData)
    }).catch(console.error).finally(() => setLoading(false))
    loadInsights()
  }, [loadInsights])

  const total = stats?.total ?? 0
  const outlierCount = outlierVideos.length
  const avgVsAvg = stats?.avgVsAvg?.toFixed(1) ?? '0.0'

  const distribution = [
    { range: '0.5–1.0x', count: allVideos.filter(v => v.vsAvg < 1.0).length,                   color: 'bg-gray-400' },
    { range: '1.0–2.0x', count: allVideos.filter(v => v.vsAvg >= 1.0 && v.vsAvg < 2.0).length, color: 'bg-blue-400' },
    { range: '2.0–3.0x', count: allVideos.filter(v => v.vsAvg >= 2.0 && v.vsAvg < 3.0).length, color: 'bg-yellow-400' },
    { range: '3.0–5.0x', count: allVideos.filter(v => v.vsAvg >= 3.0 && v.vsAvg < 5.0).length, color: 'bg-green-500' },
    { range: '5.0x+',    count: allVideos.filter(v => v.vsAvg >= 5.0).length,                   color: 'bg-purple-500' },
  ]

  return (
    <PageLoadingOverlay loading={loading} label="대시보드 데이터를 불러오는 중…">
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '전체 수집량',   value: loading ? '…' : `${total}`,         unit: 'videos',       icon: '🎬', bg: 'bg-blue-50',   accent: 'text-blue-600' },
          { label: 'Outlier 발견',  value: loading ? '…' : `${outlierCount}개`, unit: 'vs.Avg≥1.5',  icon: '🚀', bg: 'bg-green-50',  accent: 'text-green-600' },
          { label: '수집 채널',     value: loading ? '…' : `${channels.length}개`, unit: 'YouTube 채널', icon: '📺', bg: 'bg-orange-50', accent: 'text-orange-600' },
          { label: '평균 vs.Avg',   value: loading ? '…' : `${avgVsAvg}x`,     unit: '전체 평균',    icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5 cursor-pointer hover:shadow-md transition`} onClick={() => addToast(`${c.label}: ${c.value}`, 'info')}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{c.label}</span>
              <span className="text-xl">{c.icon}</span>
            </div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.unit}</p>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <TitleWithHint
              as="h2"
              className="text-base font-bold"
              hintVariant="light"
              hint="키워드를 입력하면 해당 범위의 수집 데이터·Outlier·RSS만 분석합니다. 키워드 없이 조회하면 전체 데이터 기반 추천이 표시됩니다. 카드 클릭은 기획 큐 추가, «가이드 →» 버튼은 콘텐츠 가이드로 이동합니다."
            >
              💡 AI 인사이트 & 추천 액션
            </TitleWithHint>
            {insightSubtitle && (
              <p className="text-xs text-white/60 mt-1">{insightSubtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => loadInsights(activeKeywords.length ? activeKeywords : undefined, true)}
            disabled={insightsLoading}
            className="text-xs bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-1 rounded-full transition shrink-0"
          >
            {insightsLoading ? '분석 중…' : '새로고침'}
          </button>
        </div>

        {/* 키워드 조회 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
            placeholder="키워드 입력 (쉼표·공백 구분, 최대 5개)"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white/95 border-0 focus:ring-2 focus:ring-white/50 outline-none"
          />
          <button
            type="button"
            onClick={handleKeywordSearch}
            disabled={insightsLoading}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-white text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 transition shrink-0"
          >
            {insightsLoading ? '조회 중…' : '키워드 조회'}
          </button>
          {activeKeywords.length > 0 && (
            <button
              type="button"
              onClick={clearKeywordScope}
              className="px-3 py-2 rounded-xl text-xs text-white/80 hover:text-white border border-white/30 hover:bg-white/10 transition shrink-0"
            >
              전체 보기
            </button>
          )}
        </div>

        {activeKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {activeKeywords.map((kw) => (
              <span key={kw} className="text-xs px-2.5 py-1 rounded-full bg-white/20 text-white font-medium">
                #{kw}
              </span>
            ))}
          </div>
        )}

        {insightsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/10 rounded-xl p-3 h-20 animate-pulse flex items-center justify-center">
                <Spinner size="sm" color="border-white/40" />
              </div>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-white/70 text-center py-6">
            {activeKeywords.length > 0
              ? '키워드에 맞는 인사이트를 생성하지 못했습니다. 키워드를 바꿔 다시 조회해 보세요.'
              : '인사이트를 불러오는 중이거나 데이터가 없습니다.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins, i) => (
              <InsightActionCard
                key={`${i}-${ins.text.slice(0, 20)}`}
                ins={ins}
                onAdd={handleAddInsight}
                onGoGuide={goToContentGuide}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 flex flex-col h-full min-h-[420px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <TitleWithHint
              as="h2"
              className="text-base font-bold text-gray-900 dark:text-white"
              hint="vs.Avg 1.5x 이상 상위 Outlier 영상입니다."
            >
              🏆 Outlier Videos
            </TitleWithHint>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">vs.Avg ≥ 1.5</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {loading ? (
              <div className="space-y-3 flex-1">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="space-y-3 flex-1">
                {outlierVideos.slice(0, 5).map((video, i) => (
                  <div key={video.id} onClick={() => onSelect(video)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
                    <span className="text-lg font-black text-gray-300 w-6 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{video.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{video.channel} · {formatViews(video.views)} views</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-green-600">{video.vsAvg}x</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getTierColor(video.tier)}`}>{video.tier}</span>
                    </div>
                  </div>
                ))}
                {outlierVideos.length === 0 && <p className="text-sm text-gray-400 text-center py-4">데이터 수집 후 표시됩니다</p>}
              </div>
            )}
          </div>
          <button onClick={() => addToast('전체 Outlier 목록을 불러왔습니다', 'info')} className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium shrink-0">전체 보기 →</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 flex flex-col h-full min-h-[420px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <TitleWithHint
              as="h2"
              className="text-base font-bold text-gray-900 dark:text-white"
              hint="최근 수집 영상 제목에서 추출한 급상승 키워드입니다."
            >
              🔥 급상승 키워드
            </TitleWithHint>
            <span className="text-xs text-gray-400">최근 7일</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="space-y-3 flex-1">
              {trending.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">수집 후 키워드가 표시됩니다</p>
              ) : trending.slice(0, 5).map(kw => (
                <div key={kw.rank} onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 추천!`, 'success')} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
                  <span className={`text-base font-black w-6 text-center ${kw.rank === 1 ? 'text-yellow-500' : kw.rank === 2 ? 'text-gray-400' : kw.rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>{kw.rank}</span>
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white">#{kw.keyword}</span>
                  <span className={`text-sm font-bold ${kw.trend === 'up' ? 'text-red-500' : 'text-blue-400'}`}>{kw.trend === 'up' ? '▲' : '▼'} {kw.change}%</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => addToast('트렌드 리포트를 준비했습니다', 'info')} className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium shrink-0">트렌드 리포트 →</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <TitleWithHint
            as="h2"
            className="text-base font-bold text-gray-900 dark:text-white mb-4"
            hint="전체 수집 영상의 vs.Avg 구간별 분포입니다. 3.0x 이상이 콘텐츠 기회 구간입니다."
          >
            📊 vs.Avg 분포도
          </TitleWithHint>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-7 bg-gray-100 rounded-full animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {distribution.map(item => (
                <div key={item.range} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-gray-500 shrink-0">{item.range}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-7 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full flex items-center justify-end pr-3`} style={{ width: `${Math.max(total > 0 ? (item.count / total) * 100 : 0, 8)}%` }}>
                      <span className="text-white text-xs font-bold">{item.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4 text-center">💡 3.0x 이상 구간이 콘텐츠 기회입니다</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <TitleWithHint
            as="h2"
            className="text-base font-bold text-gray-900 dark:text-white mb-4"
            hint="Supabase에 등록·수집된 YouTube 채널 요약입니다."
          >
            📺 수집 채널 현황
          </TitleWithHint>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {channels.slice(0, 5).map(ch => (
                <div key={ch.channel_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 shrink-0">YT</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ch.channel_name}</p>
                    <p className="text-xs text-gray-400">구독자 {formatViews(ch.subscribers ?? 0)} · 평균 {formatViews(ch.avg_views ?? 0)} views</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{ch.video_count}개</span>
                </div>
              ))}
              {channels.length === 0 && <p className="text-sm text-gray-400 text-center py-4">채널 데이터 없음</p>}
            </div>
          )}
        </div>
      </div>

      <ContentTable videos={allVideos} onSelect={onSelect} addToast={addToast} />
    </div>
    </PageLoadingOverlay>
  )
}
