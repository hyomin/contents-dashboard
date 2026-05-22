'use client'

import { useEffect, useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'
import { TitleWithHint } from '@/components/dashboard/info-hint'

export default function TrendingView({ addToast }: { addToast: AddToast }) {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/insights')
      .then((r) => r.json())
      .then((d) => setKeywords(d.trending ?? []))
      .catch(() => addToast('키워드 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [addToast])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <TitleWithHint
          as="h2"
          className="text-lg font-bold"
          hintVariant="light"
          hint="수집된 YouTube 영상 제목에서 키워드를 추출합니다. 최신 업로드일과 vs.Avg를 가중해 순위를 매깁니다."
        >
          🔥 트렌딩 키워드
        </TitleWithHint>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-3 border border-gray-100 dark:border-gray-700">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">분석 중…</p>
        ) : keywords.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            수집된 영상이 없습니다. 데이터 수집 후 키워드가 표시됩니다.
          </p>
        ) : (
          keywords.map((kw) => (
            <div
              key={kw.keyword}
              onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 목록에 추가!`, 'success')}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition"
            >
              <span
                className={`text-2xl font-black w-8 text-center ${
                  kw.rank === 1
                    ? 'text-yellow-500'
                    : kw.rank === 2
                      ? 'text-gray-400'
                      : kw.rank === 3
                        ? 'text-orange-400'
                        : 'text-gray-300'
                }`}
              >
                {kw.rank}
              </span>
              <span className="flex-1 text-base font-semibold text-gray-900 dark:text-white">
                #{kw.keyword}
              </span>
              <span className="text-xs text-gray-400">{kw.count}회</span>
              <span
                className={`text-base font-bold ${kw.trend === 'up' ? 'text-red-500' : 'text-blue-400'}`}
              >
                {kw.trend === 'up' ? '▲' : '▼'} {kw.change}%
              </span>
              <button
                type="button"
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
              >
                기획 추가
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
