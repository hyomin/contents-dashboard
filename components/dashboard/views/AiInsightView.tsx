'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import type { DataInsight } from '@/lib/analytics-from-videos'
import { TitleWithHint } from '@/components/dashboard/info-hint'

export default function AiInsightView({ addToast }: { addToast: AddToast }) {
  const [insights, setInsights] = useState<DataInsight[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/dashboard/insights')
      .then((r) => r.json())
      .then((d) => setInsights(d.insights ?? []))
      .catch(() => addToast('인사이트 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white flex justify-between items-start gap-4">
        <div>
          <TitleWithHint
            as="h2"
            className="text-lg font-bold"
            hintVariant="light"
            hint="Supabase에 쌓인 영상·채널 데이터를 바탕으로 규칙 기반 인사이트를 생성합니다. LLM 연동은 추후 확장 예정입니다."
          >
            🤖 AI 인사이트
          </TitleWithHint>
        </div>
        <button
          type="button"
          onClick={() => {
            load()
            addToast('인사이트를 새로고침했습니다', 'success')
          }}
          className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full shrink-0"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">분석 중…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins, i) => (
            <div
              key={i}
              onClick={() => addToast('콘텐츠 기획 목록에 추가되었습니다 ✅', 'success')}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition border border-gray-100 dark:border-gray-700"
            >
              <span className="text-3xl">{ins.icon}</span>
              <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{ins.text}</p>
              <button
                type="button"
                className="mt-4 px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
              >
                기획 추가
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
