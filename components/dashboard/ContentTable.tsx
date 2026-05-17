'use client'
import { useState } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { getTierColor, getPlatformName, getPlatformColor, getVsAvgColor, formatViews } from '@/lib/dashboard-helpers'

export default function ContentTable({ videos, onSelect, addToast }: {
  videos: Video[]
  onSelect: (v: Video) => void
  addToast: AddToast
}) {
  const [vsAvgFilter, setVsAvgFilter] = useState('전체 vs.Avg')

  const filtered = videos.filter(v =>
    vsAvgFilter === '전체 vs.Avg' ? true :
    vsAvgFilter === '3.0x 이상' ? v.vsAvg >= 3.0 :
    v.vsAvg >= 2.0
  )

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
          <button onClick={() => { setVsAvgFilter('전체 vs.Avg'); addToast('필터 초기화', 'warning') }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
            초기화
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['Tier', '제목', '채널', '조회수', 'vs.Avg', '플랫폼', '날짜'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">조건에 맞는 콘텐츠가 없습니다</td></tr>
            ) : filtered.map(video => (
              <tr key={video.id} onClick={() => onSelect(video)} className="hover:bg-blue-50/50 dark:hover:bg-gray-700 cursor-pointer transition">
                <td className="px-5 py-4"><span className={`px-2 py-0.5 text-xs font-bold rounded ${getTierColor(video.tier)}`}>{video.tier}</span></td>
                <td className="px-5 py-4 max-w-xs">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{video.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">#{video.keyword}</p>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{video.channel}</td>
                <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{formatViews(video.views)}</td>
                <td className="px-5 py-4 whitespace-nowrap"><span className={`text-sm ${getVsAvgColor(video.vsAvg)}`}>{video.vsAvg}x</span></td>
                <td className="px-5 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs rounded-full font-medium ${getPlatformColor(video.platform)}`}>{getPlatformName(video.platform)}</span></td>
                <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-400">{video.publishedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <p className="text-xs text-gray-400">{filtered.length}개 결과</p>
        <button onClick={() => addToast('데이터 수집이 시작되었습니다 (더미)', 'success')}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium">
          + 새 데이터 수집
        </button>
      </div>
    </div>
  )
}
