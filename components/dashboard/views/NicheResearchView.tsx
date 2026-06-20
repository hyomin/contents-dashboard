'use client'

import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { NicheResearchPanel } from '@/components/dashboard/NicheResearchPanel'

export default function NicheResearchView({ addToast: _addToast }: { addToast: AddToast }) {
  return (
    <div className="space-y-5">
      {/* 안내 카드 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-5 sm:p-6 text-white">
        <h2 className="text-lg font-bold mb-1">🔍 니치 탐색</h2>
        <p className="text-sm opacity-80 leading-relaxed">
          진입을 고민 중인 키워드를 검색하면 YouTube 전체에서 조회수 높은 영상 Top 20을 가져와
          AI가 제목 패턴·후킹 전략·키워드 특징을 분석합니다.
          결과는 2시간 캐시되어 API quota를 절약합니다.
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
          <span className="bg-white/20 rounded-lg px-2.5 py-1">📱 Shorts / 🎬 일반 영상 구분</span>
          <span className="bg-white/20 rounded-lg px-2.5 py-1">🤖 Gemini 패턴 분석</span>
          <span className="bg-white/20 rounded-lg px-2.5 py-1">📊 채널 vsAvg 표시</span>
          <span className="bg-white/20 rounded-lg px-2.5 py-1">📦 2시간 캐시</span>
        </div>
      </div>

      {/* 검색 패널 (기본 펼침) */}
      <NicheResearchPanel defaultExpanded />
    </div>
  )
}
