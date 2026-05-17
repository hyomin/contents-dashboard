'use client'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { ALL_VIDEOS } from '@/lib/dummy-data'
import ContentTable from '@/components/dashboard/ContentTable'

export default function OutlierView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: AddToast }) {
  const outliers = ALL_VIDEOS.filter(v => v.vsAvg >= 3.0).sort((a, b) => b.vsAvg - a.vsAvg)
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🚀 Outlier 분석</h2>
        <p className="text-sm opacity-80">채널 평균 대비 3.0x 이상 달성한 콘텐츠 {outliers.length}개</p>
      </div>
      <ContentTable videos={outliers} onSelect={onSelect} addToast={addToast} />
    </div>
  )
}
