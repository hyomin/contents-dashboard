'use client'
import { useState, useEffect } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { dbVideoToVideo } from '@/lib/dashboard-helpers'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo } from '@/lib/supabase'

export default function OutlierView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: AddToast }) {
  const [outliers, setOutliers] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [minVsAvg, setMinVsAvg] = useState(1.5)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard/videos?type=outliers&limit=50`)
      .then(r => r.json())
      .then((data: DBVideo[]) => setOutliers(data.map(dbVideoToVideo)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = outliers.filter(v => v.vsAvg >= minVsAvg)

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">🚀 Outlier 분석</h2>
            <p className="text-sm opacity-80">
              {loading ? '로딩 중…' : `채널 평균 대비 ${minVsAvg}x 이상 달성한 콘텐츠 ${filtered.length}개`}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
            <span className="text-sm">기준:</span>
            {[1.5, 2.0, 3.0, 5.0].map(v => (
              <button key={v} onClick={() => setMinVsAvg(v)}
                className={`text-sm px-2 py-0.5 rounded-lg font-bold transition ${minVsAvg === v ? 'bg-white text-green-700' : 'text-white hover:bg-white/20'}`}>
                {v}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">n8n 워크플로를 실행해서 데이터를 수집해주세요</p>
        </div>
      ) : (
        <ContentTable videos={filtered} onSelect={onSelect} addToast={addToast} />
      )}
    </div>
  )
}
