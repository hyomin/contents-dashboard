'use client'
import { useState, useEffect } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import type { DataInsight, TrendingKeyword } from '@/lib/analytics-from-videos'
import { getTierColor, getPlatformName, getPlatformColor, formatViews, dbVideoToVideo } from '@/lib/dashboard-helpers'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo, DBChannel } from '@/lib/supabase'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface VideoStats {
  total: number
  byPlatform: Record<string, number>
  byTier: Record<string, number>
  avgVsAvg: number
}

export default function OverviewView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: AddToast }) {
  const [stats, setStats] = useState<VideoStats | null>(null)
  const [outlierVideos, setOutlierVideos] = useState<Video[]>([])
  const [allVideos, setAllVideos] = useState<Video[]>([])
  const [channels, setChannels] = useState<DBChannel[]>([])
  const [insights, setInsights] = useState<DataInsight[]>([])
  const [trending, setTrending] = useState<TrendingKeyword[]>([])
  const [loading, setLoading] = useState(true)

  const loadInsights = () => {
    fetch('/api/dashboard/insights')
      .then((r) => r.json())
      .then((d) => {
        setInsights(d.insights ?? [])
        setTrending(d.trending ?? [])
      })
      .catch(console.error)
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
  }, [])

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
        <div className="flex items-center justify-between mb-4">
          <TitleWithHint
            as="h2"
            className="text-base font-bold"
            hintVariant="light"
            hint="수집 데이터 기반 규칙 인사이트와 추천 액션입니다. 카드를 클릭하면 기획 목록에 추가됩니다."
          >
            💡 AI 인사이트 & 추천 액션
          </TitleWithHint>
          <button type="button" onClick={() => { loadInsights(); addToast('인사이트 새로고침 완료', 'success') }} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition">새로고침</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <div key={i} onClick={() => addToast('콘텐츠 기획 목록에 추가되었습니다 ✅', 'success')} className="bg-white/10 hover:bg-white/20 rounded-xl p-3 flex gap-3 items-start cursor-pointer transition">
              <span className="text-xl">{ins.icon}</span>
              <p className="text-sm leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <TitleWithHint
              as="h2"
              className="text-base font-bold text-gray-900 dark:text-white"
              hint="vs.Avg 1.5x 이상 상위 Outlier 영상입니다."
            >
              🏆 Outlier Videos
            </TitleWithHint>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">vs.Avg ≥ 1.5</span>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
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
          <button onClick={() => addToast('전체 Outlier 목록을 불러왔습니다', 'info')} className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium">전체 보기 →</button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <TitleWithHint
              as="h2"
              className="text-base font-bold text-gray-900 dark:text-white"
              hint="최근 수집 영상 제목에서 추출한 급상승 키워드입니다."
            >
              🔥 급상승 키워드
            </TitleWithHint>
            <span className="text-xs text-gray-400">최근 7일</span>
          </div>
          <div className="space-y-3">
            {trending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">수집 후 키워드가 표시됩니다</p>
            ) : trending.map(kw => (
              <div key={kw.rank} onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 추천!`, 'success')} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
                <span className={`text-base font-black w-6 text-center ${kw.rank === 1 ? 'text-yellow-500' : kw.rank === 2 ? 'text-gray-400' : kw.rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>{kw.rank}</span>
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white">#{kw.keyword}</span>
                <span className={`text-sm font-bold ${kw.trend === 'up' ? 'text-red-500' : 'text-blue-400'}`}>{kw.trend === 'up' ? '▲' : '▼'} {kw.change}%</span>
              </div>
            ))}
          </div>
          <button onClick={() => addToast('트렌드 리포트를 준비했습니다', 'info')} className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium">트렌드 리포트 →</button>
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
  )
}
