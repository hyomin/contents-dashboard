'use client'
import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import { COMPETITOR_CHANNELS } from '@/lib/dummy-data'
import { getTierColor, getPlatformName, getPlatformIcon, getPlatformColor, formatViews } from '@/lib/dashboard-helpers'

export default function CompetitorChannelsView({ addToast }: { addToast: AddToast }) {
  const [channels, setChannels] = useState(COMPETITOR_CHANNELS)

  const toggleTrack = (id: number) => {
    const ch = channels.find(c => c.id === id)
    setChannels(prev => prev.map(c => c.id === id ? { ...c, tracked: !c.tracked } : c))
    addToast(ch?.tracked ? `"${ch?.name}" 추적 해제` : `"${ch?.name}" 추적 시작!`, ch?.tracked ? 'warning' : 'success')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">경쟁 채널 목록</h3>
            <p className="text-xs text-gray-400 mt-0.5">추적 중: {channels.filter(c => c.tracked).length}개</p>
          </div>
          <button onClick={() => addToast('채널 추가 기능은 준비 중입니다', 'info')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">+ 채널 추가</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {channels.map(ch => (
            <div key={ch.id} className="p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg shrink-0">{getPlatformIcon(ch.platform)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ch.name}</p>
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${getPlatformColor(ch.platform)}`}>{getPlatformName(ch.platform)}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getTierColor(ch.tier)}`}>{ch.tier}</span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span>구독자 {(ch.subs / 10000).toFixed(1)}만</span>
                  <span>평균 {formatViews(ch.avgViews)} views</span>
                  <span>영상 {ch.videos}개</span>
                  <span className="text-blue-500">#{ch.topKeyword}</span>
                </div>
              </div>
              <button onClick={() => toggleTrack(ch.id)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition shrink-0 ${ch.tracked ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700'}`}>
                {ch.tracked ? '✓ 추적 중' : '+ 추적'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
