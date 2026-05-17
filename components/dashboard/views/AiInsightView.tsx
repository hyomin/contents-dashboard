'use client'
import type { AddToast } from '@/lib/dashboard-types'
import { INSIGHTS } from '@/lib/dummy-data'

export default function AiInsightView({ addToast }: { addToast: AddToast }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🤖 AI 인사이트</h2>
        <p className="text-sm opacity-80">데이터 기반 콘텐츠 기획 추천</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INSIGHTS.map((ins, i) => (
          <div key={i} onClick={() => addToast('콘텐츠 기획 목록에 추가되었습니다 ✅', 'success')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md cursor-pointer transition border border-gray-100 dark:border-gray-700">
            <span className="text-3xl">{ins.icon}</span>
            <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{ins.text}</p>
            <button className="mt-4 px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">기획 추가</button>
          </div>
        ))}
      </div>
    </div>
  )
}
