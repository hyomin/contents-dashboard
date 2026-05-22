'use client'

import { formatViews, getVsAvgColor } from '@/lib/dashboard/dashboard-helpers'
import { formatDurationLabel } from '@/lib/data/video-format'

export interface SavedShortItem {
  video_id: string
  channel_name: string | null
  title: string
  thumbnail_url: string | null
  views: number
  vs_avg: number
  duration: number
  saved_at: string
}

interface SavedShortsPanelProps {
  items: SavedShortItem[]
  onRemove: (videoId: string) => void
}

export function SavedShortsPanel({ items, onRemove }: SavedShortsPanelProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-6 text-center text-sm text-gray-500">
        저장한 Shorts가 없습니다. 아래 목록에서 ★ 버튼으로 추가하세요.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-orange-100 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">⭐ 저장한 인기 Shorts ({items.length})</h3>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <li key={item.video_id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            {item.thumbnail_url ? (
              <img src={item.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <span className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                ⚡
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {item.channel_name ?? '—'} · {formatViews(item.views)} · {formatDurationLabel(item.duration)}
              </p>
            </div>
            <span className={`text-sm font-bold shrink-0 ${getVsAvgColor(Number(item.vs_avg))}`}>
              {Number(item.vs_avg).toFixed(1)}x
            </span>
            <a
              href={`https://www.youtube.com/shorts/${item.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0"
            >
              열기
            </a>
            <button
              type="button"
              onClick={() => onRemove(item.video_id)}
              className="text-xs px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
