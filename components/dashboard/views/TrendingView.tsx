'use client'
import type { AddToast } from '@/lib/dashboard-types'
import { TRENDING_KEYWORDS } from '@/lib/dummy-data'

export default function TrendingView({ addToast }: { addToast: AddToast }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🔥 트렌딩 키워드</h2>
        <p className="text-sm opacity-80">최근 7일간 급상승한 키워드 분석</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-3">
        {TRENDING_KEYWORDS.map(kw => (
          <div key={kw.rank} onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 목록에 추가!`, 'success')}
            className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
            <span className={`text-2xl font-black w-8 text-center ${kw.rank === 1 ? 'text-yellow-500' : kw.rank === 2 ? 'text-gray-400' : kw.rank === 3 ? 'text-orange-400' : 'text-gray-300'}`}>{kw.rank}</span>
            <span className="flex-1 text-base font-semibold text-gray-900 dark:text-white">#{kw.keyword}</span>
            <span className={`text-base font-bold ${kw.trend === 'up' ? 'text-red-500' : 'text-blue-400'}`}>{kw.trend === 'up' ? '▲' : '▼'} {kw.change}%</span>
            <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">기획 추가</button>
          </div>
        ))}
      </div>
    </div>
  )
}
