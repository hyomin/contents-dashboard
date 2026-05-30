'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { TrendingKeyword } from '@/lib/data/analytics-from-videos'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { PageLoadingOverlay } from '@/components/dashboard/ui/loading'

type FormatTab = 'all' | 'short' | 'long'
type PeriodTab = 'all' | '7d' | '30d' | '90d'

interface TrendingResponse {
  keywords: TrendingKeyword[]
  byFormat: {
    all: TrendingKeyword[]
    short: TrendingKeyword[]
    long: TrendingKeyword[]
  }
  cached: boolean
}

const FORMAT_LABELS: Record<FormatTab, string> = {
  all: '전체',
  short: '📱 숏폼',
  long: '🎬 롱폼',
}

const PERIOD_LABELS: Record<PeriodTab, string> = {
  all: '전체',
  '7d': '7일',
  '30d': '30일',
  '90d': '90일',
}

export default function TrendingView({ addToast }: { addToast: AddToast }) {
  const [response, setResponse] = useState<TrendingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [formatTab, setFormatTab] = useState<FormatTab>('all')
  const [period, setPeriod] = useState<PeriodTab>('all')

  const fetchTrending = useCallback(
    (p: PeriodTab) => {
      setLoading(true)
      const params = new URLSearchParams({ limit: '20' })
      if (p !== 'all') params.set('period', p)
      fetch(`/api/dashboard/trending?${params}`)
        .then((r) => r.json())
        .then((d: TrendingResponse) => setResponse(d))
        .catch(() => addToast('키워드 로드 실패', 'warning'))
        .finally(() => setLoading(false))
    },
    [addToast],
  )

  useEffect(() => {
    fetchTrending(period)
  }, [period, fetchTrending])

  const keywords: TrendingKeyword[] =
    response
      ? formatTab === 'all'
        ? response.byFormat.all
        : formatTab === 'short'
          ? response.byFormat.short
          : response.byFormat.long
      : []

  return (
    <PageLoadingOverlay loading={loading} label="트렌딩 키워드 분석 중…">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <TitleWithHint
                as="h2"
                className="text-lg font-bold"
                hintVariant="light"
                hint="수집된 YouTube 영상 제목에서 키워드를 추출합니다. 최신 업로드일과 vs.Avg를 가중해 순위를 매깁니다. 포맷 탭으로 숏폼·롱폼 키워드를 분리 확인할 수 있습니다."
              >
                🔥 트렌딩 키워드
              </TitleWithHint>
              <p className="text-sm opacity-80 mt-1">
                {loading
                  ? '분석 중…'
                  : `${keywords.length}개 키워드 · ${PERIOD_LABELS[period]} 기준`}
              </p>
            </div>

            {/* 기간 필터 */}
            <div className="flex items-center gap-1 bg-white/20 rounded-xl px-2 py-1.5">
              {(Object.keys(PERIOD_LABELS) as PeriodTab[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    period === p ? 'bg-white text-orange-600' : 'text-white hover:bg-white/20'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 포맷 탭 */}
        <div className="flex gap-2">
          {(Object.keys(FORMAT_LABELS) as FormatTab[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormatTab(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                formatTab === f
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'
              }`}
            >
              {FORMAT_LABELS[f]}
              {!loading && response && (
                <span className="ml-1.5 text-xs opacity-70">
                  {f === 'all'
                    ? response.byFormat.all.length
                    : f === 'short'
                      ? response.byFormat.short.length
                      : response.byFormat.long.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 키워드 목록 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-3 border border-gray-100 dark:border-gray-700">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : keywords.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-3">📭</p>
              <p className="font-medium">
                {formatTab !== 'all'
                  ? `${FORMAT_LABELS[formatTab]} 영상 데이터가 없습니다.`
                  : '수집된 영상이 없습니다. 데이터 수집 후 키워드가 표시됩니다.'}
              </p>
            </div>
          ) : (
            keywords.map((kw) => (
              <div
                key={kw.keyword}
                onClick={() => addToast(`"${kw.keyword}" 콘텐츠 기획 목록에 추가!`, 'success')}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-orange-50 dark:hover:bg-gray-700 cursor-pointer transition group"
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
                  onClick={(e) => {
                    e.stopPropagation()
                    addToast(`"${kw.keyword}" 기획 큐에 추가됨`, 'success')
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition opacity-0 group-hover:opacity-100"
                >
                  기획 추가
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </PageLoadingOverlay>
  )
}
