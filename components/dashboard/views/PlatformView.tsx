'use client'
import { useState } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { ALL_VIDEOS } from '@/lib/dummy-data'
import { getCategoryStyle } from '@/lib/categories'
import { DEFAULT_CATEGORIES } from '@/lib/categories'
import ContentTable from '@/components/dashboard/ContentTable'

const KEYWORD_TO_CATEGORY: Record<string, string> = {
  '경제': 'cat-1', '부동산': 'cat-1', '주식': 'cat-1', '투자': 'cat-1', '금리': 'cat-1',
  '생산성': 'cat-2', '독서': 'cat-2', '커리어': 'cat-2',
  '건강': 'cat-3', '요리': 'cat-3', '여행': 'cat-3',
  '수익화': 'cat-4', '유튜브': 'cat-4', '블로그': 'cat-4',
}

export default function PlatformView({ filter, onSelect, addToast }: { filter: string; onSelect: (v: Video) => void; addToast: AddToast }) {
  const [selectedCategory, setSelectedCategory] = useState('')
  const baseVideos = ALL_VIDEOS.filter(v => v.platform === filter)
  const videos = selectedCategory ? baseVideos.filter(v => KEYWORD_TO_CATEGORY[v.keyword] === selectedCategory) : baseVideos
  const outliers = videos.filter(v => v.vsAvg >= 3.0)
  const avgVsAvg = videos.length ? (videos.reduce((s, v) => s + v.vsAvg, 0) / videos.length).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">주제 필터:</span>
        <button onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 text-sm rounded-xl font-medium transition ${!selectedCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          전체 ({baseVideos.length})
        </button>
        {DEFAULT_CATEGORIES.map(cat => {
          const count = baseVideos.filter(v => KEYWORD_TO_CATEGORY[v.keyword] === cat.id).length
          const isActive = selectedCategory === cat.id
          const style = getCategoryStyle(cat)
          return (
            <button key={cat.id} onClick={() => setSelectedCategory(isActive ? '' : cat.id)}
              className="px-3 py-1.5 text-sm rounded-xl font-medium transition border"
              style={isActive ? style : { background: 'white', color: '#4b5563', borderColor: '#e5e7eb' }}>
              {cat.name} ({count})
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '수집된 콘텐츠', value: `${videos.length}개`, icon: '🎬', bg: 'bg-blue-50',   accent: 'text-blue-600' },
          { label: 'Outlier',       value: `${outliers.length}개`, icon: '🚀', bg: 'bg-green-50',  accent: 'text-green-600' },
          { label: '평균 vs.Avg',   value: `${avgVsAvg}x`,         icon: '📈', bg: 'bg-purple-50', accent: 'text-purple-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><span>{c.icon}</span></div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <ContentTable videos={videos} onSelect={onSelect} addToast={addToast} />
    </div>
  )
}
