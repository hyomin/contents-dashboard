'use client'
import { useState, useMemo } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { getTierColor, getVsAvgColor, formatViews } from '@/lib/dashboard-helpers'
import { formatDurationLabel } from '@/lib/video-format'

// ─── 정렬 타입 ────────────────────────────────────────────────
type SortKey = 'tier' | 'title' | 'channel' | 'views' | 'vsAvg' | 'platform' | 'publishedAt'
type SortDir = 'asc' | 'desc'

const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }

const BASE_COLUMNS: { key: SortKey; label: string; align?: string }[] = [
  { key: 'tier', label: 'Tier' },
  { key: 'title', label: '제목' },
  { key: 'channel', label: '채널' },
  { key: 'views', label: '조회수', align: 'right' },
  { key: 'vsAvg', label: 'vs.Avg', align: 'right' },
  { key: 'publishedAt', label: '날짜' },
]

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 opacity-30 text-gray-400">⇅</span>
  return <span className="ml-1 text-blue-500">{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function ContentTable({
  videos,
  onSelect,
  addToast,
  showDuration = false,
  savedVideoIds,
  onToggleSave,
}: {
  videos: Video[]
  onSelect: (v: Video) => void
  addToast: AddToast
  showDuration?: boolean
  savedVideoIds?: Set<string>
  onToggleSave?: (v: Video) => void
}) {
  const [vsAvgFilter, setVsAvgFilter] = useState('전체 vs.Avg')
  const [sortKey, setSortKey] = useState<SortKey>('vsAvg')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const showSaveCol = Boolean(onToggleSave)
  const colSpan = BASE_COLUMNS.length + (showDuration ? 1 : 0) + (showSaveCol ? 1 : 0)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // 숫자 컬럼은 기본 내림차순, 텍스트 컬럼은 오름차순
      setSortDir(['views', 'vsAvg'].includes(key) ? 'desc' : 'asc')
    }
  }

  const filtered = useMemo(() => {
    const base = videos.filter(v =>
      vsAvgFilter === '전체 vs.Avg' ? true :
      vsAvgFilter === '3.0x 이상' ? v.vsAvg >= 3.0 :
      v.vsAvg >= 2.0
    )

    return [...base].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'tier':
          cmp = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title, 'ko')
          break
        case 'channel':
          cmp = (a.channel ?? '').localeCompare(b.channel ?? '', 'ko')
          break
        case 'views':
          cmp = (a.views ?? 0) - (b.views ?? 0)
          break
        case 'vsAvg':
          cmp = (a.vsAvg ?? 0) - (b.vsAvg ?? 0)
          break
        case 'platform':
          cmp = a.platform.localeCompare(b.platform)
          break
        case 'publishedAt':
          cmp = (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [videos, vsAvgFilter, sortKey, sortDir])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">📋 수집 콘텐츠 목록</h2>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length}개 표시 중 (전체 {videos.length}개)</p>
        </div>
        <div className="flex gap-2">
          <select
            value={vsAvgFilter}
            onChange={e => { setVsAvgFilter(e.target.value); addToast(`${e.target.value} 필터 적용`, 'info') }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option>전체 vs.Avg</option>
            <option>3.0x 이상</option>
            <option>2.0x 이상</option>
          </select>
          <button
            onClick={() => { setVsAvgFilter('전체 vs.Avg'); setSortKey('vsAvg'); setSortDir('desc'); addToast('필터 초기화', 'warning') }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {BASE_COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider
                    cursor-pointer select-none whitespace-nowrap
                    hover:bg-gray-100 dark:hover:bg-gray-600 transition
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                    ${sortKey === col.key ? 'text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/20' : ''}
                  `}
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </th>
              ))}
              {showDuration && (
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">길이</th>
              )}
              {showSaveCol && (
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center w-14">저장</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-gray-400">
                  조건에 맞는 콘텐츠가 없습니다
                </td>
              </tr>
            ) : filtered.map(video => (
              <tr
                key={video.videoId || video.id}
                onClick={() => onSelect(video)}
                className="hover:bg-blue-50/50 dark:hover:bg-gray-700 cursor-pointer transition"
              >
                <td className="px-5 py-4">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${getTierColor(video.tier)}`}>
                    {video.tier}
                  </span>
                </td>
                <td className="px-5 py-4 max-w-xs">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{video.title}</p>
                  {video.keyword && <p className="text-xs text-gray-400 mt-0.5">#{video.keyword}</p>}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{video.channel}</td>
                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-right">
                  {formatViews(video.views)}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right">
                  <span className={`text-sm font-semibold ${getVsAvgColor(video.vsAvg)}`}>{video.vsAvg}x</span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-400">{video.publishedAt}</td>
                {showDuration && (
                  <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500 text-right">
                    {formatDurationLabel(video.duration)}
                  </td>
                )}
                {showSaveCol && onToggleSave && (
                  <td className="px-5 py-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleSave(video)
                      }}
                      className={`text-lg leading-none ${savedVideoIds?.has(video.videoId) ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                      aria-label={savedVideoIds?.has(video.videoId) ? '저장 해제' : 'Shorts 저장'}
                    >
                      {savedVideoIds?.has(video.videoId) ? '★' : '☆'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <p className="text-xs text-gray-400">{filtered.length}개 결과</p>
        <button
          onClick={() => addToast('데이터 수집이 시작되었습니다 (더미)', 'success')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + 새 데이터 수집
        </button>
      </div>
    </div>
  )
}
