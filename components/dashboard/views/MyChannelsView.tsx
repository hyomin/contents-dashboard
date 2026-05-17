'use client'
import type { AddToast } from '@/lib/dashboard-types'
import { MY_CHANNELS } from '@/lib/dummy-data'
import { getPlatformIcon } from '@/lib/dashboard-helpers'

export default function MyChannelsView({ addToast }: { addToast: AddToast }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-blue-800">📺 내 채널 현황</p>
        <p className="text-xs text-blue-600 mt-1">실제 데이터 연동 전 · 수동 업데이트 가능</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MY_CHANNELS.map(ch => {
          const progress = Math.min((ch.subs / ch.goal) * 100, 100)
          return (
            <div key={ch.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getPlatformIcon(ch.platform)}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{ch.name}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${ch.status === '운영중' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{ch.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{ch.subs.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">구독자/팔로워</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{ch.videos}</p>
                  <p className="text-xs text-gray-400 mt-0.5">게시물</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>목표: {ch.goal.toLocaleString()}명</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${progress > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: `${Math.max(progress, 2)}%` }} />
                </div>
              </div>
              <button onClick={() => addToast(`"${ch.name}" 정보 업데이트 완료`, 'success')} className="w-full mt-4 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-xl transition font-medium">수동 업데이트</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
