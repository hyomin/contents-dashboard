'use client'

import Link from 'next/link'
import { getPlatformIcon, getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import { isCollectionEnabled, isPlatformComingSoon, isPlatformDummyPreview } from '@/lib/dashboard/platforms'

const PLATFORMS = [
  { id: 'youtube', desc: 'Shorts·롱폼 · vs.Avg·Outlier' },
  { id: 'naver-blog', desc: 'n8n·검색 API 수집 · 조회수·vs.Avg 갱신' },
  { id: 'tiktok', desc: 'Apify 연동 전 · 더미 미리보기' },
  { id: 'instagram', desc: '수집 준비 중' },
  { id: 'tistory', desc: 'RSS 수집 · 제목·날짜·링크 (조회수 미제공)' },
] as const

export function AnalysisHubView() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
        왼쪽 메뉴에서 플랫폼을 선택하세요. 상위 «콘텐츠 분석»만 누르면 이 화면이 열립니다.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const ready = isCollectionEnabled(p.id)
          const soon = isPlatformComingSoon(p.id)
          const dummy = isPlatformDummyPreview(p.id)
          return (
            <Link
              key={p.id}
              href={`/dashboard?view=${p.id}`}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:border-blue-400 dark:hover:border-blue-600 transition shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getPlatformIcon(p.id)}</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {getPlatformName(p.id)}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</p>
              <p className="text-[11px] mt-3 font-medium text-blue-600 dark:text-blue-400">
                {ready ? '수집 연동됨 →' : dummy ? '더미 보기 →' : soon ? '준비 중 →' : '열기 →'}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
