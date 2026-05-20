'use client'
import { useState, useEffect } from 'react'
import type { Video, AddToast } from '@/lib/dashboard-types'
import { dbVideoToVideo } from '@/lib/dashboard-helpers'
import { outlierTagToVideo } from '@/lib/outlier-tagging'
import type { OutlierTagRow } from '@/lib/outlier-tagging'
import ContentTable from '@/components/dashboard/ContentTable'
import type { DBVideo } from '@/lib/supabase'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { N8nLv1ServicesSection } from '@/components/dashboard/n8n-lv1-services-section'

export default function OutlierView({ onSelect, addToast }: { onSelect: (v: Video) => void; addToast: AddToast }) {
  const [outliers, setOutliers] = useState<Video[]>([])
  const [taggedCount, setTaggedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tagging, setTagging] = useState(false)
  const [minVsAvg, setMinVsAvg] = useState(1.5)
  const [showTaggedOnly, setShowTaggedOnly] = useState(false)

  const loadOutliers = () => {
    setLoading(true)
    const type = showTaggedOnly ? 'tagged-outliers' : 'outliers'
    fetch(`/api/dashboard/videos?type=${type}&limit=50`)
      .then((r) => r.json())
      .then((data: DBVideo[] | OutlierTagRow[]) => {
        if (showTaggedOnly) {
          setOutliers((data as OutlierTagRow[]).map((row, i) => outlierTagToVideo(row, i)))
        } else {
          setOutliers((data as DBVideo[]).map(dbVideoToVideo))
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
    fetch('/api/dashboard/outlier-tag')
      .then((r) => r.json())
      .then((d: { count?: number }) => setTaggedCount(d.count ?? 0))
      .catch(() => setTaggedCount(0))
  }

  useEffect(() => {
    loadOutliers()
  }, [showTaggedOnly])

  const runTagging = async () => {
    setTagging(true)
    try {
      const res = await fetch('/api/n8n/lv1-services/outlier-tagging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minVsAvg: 3, persistTagged: true }),
      })
      const data = await res.json()
      addToast(
        typeof data.message === 'string' ? data.message : '태깅 완료',
        data.ok !== false ? 'success' : 'warning',
      )
      loadOutliers()
    } catch {
      addToast('태깅 실행 실패', 'warning')
    } finally {
      setTagging(false)
    }
  }

  const filtered = outliers.filter(v => v.vsAvg >= minVsAvg)

  return (
    <div className="space-y-6">
      <N8nLv1ServicesSection viewId="outlier" addToast={addToast} />

      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <TitleWithHint
              as="h2"
              className="text-lg font-bold"
              hintVariant="light"
              hint="채널 평균 조회수 대비 성과(vs.Avg)가 기준 배수 이상인 콘텐츠를 필터링합니다. 기본 기준은 1.5x이며 버튼으로 조절할 수 있습니다."
            >
              🚀 Outlier 분석
            </TitleWithHint>
            <p className="text-sm opacity-80 mt-1">
              {loading
                ? '로딩 중…'
                : `채널 평균 대비 ${minVsAvg}x 이상 · ${filtered.length}개 · 태깅 저장 ${taggedCount}개`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runTagging}
              disabled={tagging}
              className="text-sm font-semibold px-3 py-2 rounded-xl bg-white text-green-700 hover:bg-green-50 disabled:opacity-60"
            >
              {tagging ? '태깅 중…' : '▶ 3x+ 자동 태깅'}
            </button>
            <label className="flex items-center gap-1.5 text-xs bg-white/20 rounded-lg px-2 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showTaggedOnly}
                onChange={(e) => setShowTaggedOnly(e.target.checked)}
                className="rounded"
              />
              태깅만 보기
            </label>
          </div>
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
            <span className="text-sm">기준:</span>
            {[1.5, 2.0, 3.0, 5.0].map(v => (
              <button key={v} onClick={() => setMinVsAvg(v)}
                className={`text-sm px-2 py-0.5 rounded-lg font-bold transition ${minVsAvg === v ? 'bg-white text-green-700' : 'text-white hover:bg-white/20'}`}>
                {v}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">n8n 워크플로를 실행해서 데이터를 수집해주세요</p>
        </div>
      ) : (
        <ContentTable videos={filtered} onSelect={onSelect} addToast={addToast} />
      )}
    </div>
  )
}
