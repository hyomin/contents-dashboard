'use client'
import { useState, useEffect } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { getCategoryStyle } from '@/lib/categories'
import { dbVideoToVideo } from '@/lib/dashboard-helpers'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo } from '@/lib/supabase'

export default function PlatformView({ filter, onSelect, addToast }: { filter: string; onSelect: (v: Video) => void; addToast: AddToast }) {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [baseVideos, setBaseVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setBaseVideos([])
    fetch(`/api/dashboard/videos?platform=${filter}&limit=100`)
      .then(r => r.json())
      .then((data: DBVideo[]) => setBaseVideos(data.map(dbVideoToVideo)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  const videos = selectedCategory
    ? baseVideos.filter(v => v.channel === selectedCategory)
    : baseVideos
  const outliers = videos.filter(v => v.vsAvg >= 1.5)
  const avgVsAvg = videos.length ? (videos.reduce((s, v) => s + v.vsAvg, 0) / videos.length).toFixed(1) : '0'

  // 채널별 그룹 (카테고리 필터 대용)
  const channelNames = [...new Set(baseVideos.map(v => v.channel).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">채널 필터:</span>
        <button onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition ${!selectedCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          전체 ({baseVideos.length})
        </button>
        {channelNames.map(name => {
          const isActive = selectedCategory === name
          return (
            <button key={name} onClick={() => setSelectedCategory(isActive ? '' : name)}
              className={`px-3 py-1.5 text-sm rounded-xl font-medium transition border ${isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {name} ({baseVideos.filter(v => v.channel === name).length})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '수집된 콘텐츠', value: loading ? '…' : `${videos.length}개`, icon: '🎬', bg: 'bg-blue-50',   accent: 'text-blue-600' },
          { label: 'Outlier (≥1.5x)', value: loading ? '…' : `${outliers.length}개`, icon: '🚀', bg: 'bg-green-50',  accent: 'text-green-600' },
          { label: '평균 vs.Avg',   value: loading ? '…' : `${avgVsAvg}x`,  icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><span>{c.icon}</span></div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">이 플랫폼의 데이터가 없습니다</p>
          <p className="text-sm mt-1">n8n 워크플로를 실행해서 데이터를 수집해주세요</p>
        </div>
      ) : (
        <ContentTable videos={videos} onSelect={onSelect} addToast={addToast} />
      )}
    </div>
  )
}
