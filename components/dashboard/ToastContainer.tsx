'use client'

import { useEffect } from 'react'
import type { Video, Toast } from '@/lib/dashboard/dashboard-types'
import { getTierColor, formatViews } from '@/lib/dashboard/dashboard-helpers'

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: number) => void
  /** 자동 닫힘 지연(ms). 0이면 자동 닫힘 없음 */
  dismissMs?: number
}

function ToastItem({
  toast,
  onRemove,
  dismissMs,
}: {
  toast: Toast
  onRemove: (id: number) => void
  dismissMs: number
}) {
  useEffect(() => {
    if (dismissMs <= 0) return
    const timer = window.setTimeout(() => onRemove(toast.id), dismissMs)
    return () => window.clearTimeout(timer)
  }, [toast.id, onRemove, dismissMs])

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white
        ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-600'}`}
    >
      <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="ml-2 shrink-0 opacity-70 hover:opacity-100"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onRemove, dismissMs = 4500 }: ToastContainerProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} dismissMs={dismissMs} />
      ))}
    </div>
  )
}

export function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <span className={`px-3 py-1 text-sm font-bold rounded-full ${getTierColor(video.tier)}`}>
            Tier {video.tier}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
            ✕
          </button>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{video.title}</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: '조회수', value: formatViews(video.views), color: 'bg-gray-50' },
            { label: 'vs. 채널 평균', value: `${video.vsAvg}x`, color: 'bg-green-50' },
            { label: '채널', value: video.channel, color: 'bg-gray-50' },
            { label: '게시일', value: video.publishedAt, color: 'bg-gray-50' },
          ].map(c => (
            <div key={c.label} className={`${c.color} dark:bg-gray-700 rounded-xl p-4 text-center`}>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">💡 인사이트</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            채널 평균 대비 <span className="font-bold">{video.vsAvg}배</span> 높은 조회수.
            &quot;{video.keyword}&quot; 관련 후속 콘텐츠를 추천합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            벤치마킹 저장
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
