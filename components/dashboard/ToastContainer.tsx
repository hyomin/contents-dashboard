'use client'

import { useEffect, useState } from 'react'
import type { Video, Toast, AddToast } from '@/lib/dashboard/dashboard-types'
import { getTierColor, formatViews, getPlatformIcon } from '@/lib/dashboard/dashboard-helpers'

function getContentUrl(video: Video): string {
  if (video.videoId.startsWith('http')) return video.videoId
  if (video.platform === 'naver-blog') return `https://blog.naver.com/${video.videoId}`
  if (video.platform === 'youtube') return `https://www.youtube.com/watch?v=${video.videoId}`
  if (video.platform === 'tistory') return `https://${video.channelId ?? 'blog'}.tistory.com`
  return `https://www.youtube.com/watch?v=${video.videoId}`
}

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
        ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'warning' ? 'bg-yellow-500' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}
    >
      <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
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

export function VideoModal({
  video,
  onClose,
  addToast,
}: {
  video: Video
  onClose: () => void
  addToast?: AddToast
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const contentUrl = getContentUrl(video)

  const handleSaveBenchmark = async () => {
    if (isSaved || isSaving) return
    setIsSaving(true)
    try {
      const id = `bm-${video.videoId}-${Date.now()}`
      const res = await fetch('/api/dashboard/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          url: contentUrl,
          title: video.title,
          platform: video.platform,
          views: video.views,
          vs_avg: video.vsAvg,
          memo: `vs.Avg ${video.vsAvg}x · ${video.channel} · ${video.publishedAt}`,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setIsSaved(true)
      addToast?.('벤치마킹에 저장되었습니다', 'success')
    } catch (e) {
      addToast?.(e instanceof Error ? e.message : '벤치마킹 저장 실패', 'warning')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${getTierColor(video.tier)}`}>
              Tier {video.tier}
            </span>
            <span className="text-base">{getPlatformIcon(video.platform)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold leading-none"
          >
            ✕
          </button>
        </div>

        {/* 제목 */}
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 leading-snug">
          {contentUrl ? (
            <a
              href={contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              {video.title} ↗
            </a>
          ) : (
            video.title
          )}
        </h3>

        {/* 지표 그리드 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: '조회수', value: formatViews(video.views), color: 'bg-gray-50 dark:bg-gray-700' },
            { label: 'vs. 채널 평균', value: `${video.vsAvg}x`, color: 'bg-green-50 dark:bg-green-900/30' },
            { label: '채널', value: video.channel || '—', color: 'bg-gray-50 dark:bg-gray-700' },
            { label: '게시일', value: video.publishedAt || '—', color: 'bg-gray-50 dark:bg-gray-700' },
          ].map(c => (
            <div key={c.label} className={`${c.color} rounded-xl p-3 text-center`}>
              <p className="text-base font-bold text-gray-900 dark:text-white truncate">{c.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* 인사이트 */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3.5 mb-5">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">💡 인사이트</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            채널 평균 대비 <span className="font-bold">{video.vsAvg}배</span> 높은 조회수.
            {video.keyword && (
              <> &quot;<span className="font-medium">{video.keyword}</span>&quot; 관련 후속 콘텐츠를 추천합니다.</>
            )}
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveBenchmark}
            disabled={isSaving || isSaved}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition
              ${isSaved
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                : isSaving
                  ? 'bg-blue-300 dark:bg-blue-800 text-white cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {isSaved ? '✓ 벤치마킹 저장됨' : isSaving ? '저장 중…' : '벤치마킹 저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
