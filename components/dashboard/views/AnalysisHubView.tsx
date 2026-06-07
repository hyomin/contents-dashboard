'use client'

import { useState, useCallback } from 'react'
import type { Video, AddToast } from '@/lib/dashboard/dashboard-types'
import { getPlatformIcon, getPlatformName } from '@/lib/dashboard/dashboard-helpers'
import PlatformView from '@/components/dashboard/views/PlatformView'
import type { ViewVideoFormat } from '@/lib/dashboard/dashboard-nav'

interface Platform {
  id: string
  label: string
  icon: string
  badge?: string
  badgeColor?: string
  subFormats?: { value: ViewVideoFormat | null; label: string }[]
}

const PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '🔴',
    subFormats: [
      { value: null, label: '전체' },
      { value: 'short', label: 'Shorts' },
      { value: 'long', label: '롱폼' },
    ],
  },
  {
    id: 'naver-blog',
    label: '네이버 블로그',
    icon: '🟢',
  },
  {
    id: 'tistory',
    label: '티스토리',
    icon: '🟠',
  },
]

type PlatformStatusKey = 'ready'

const PLATFORM_STATUS: Record<PlatformStatusKey, { label: string; color: string }> = {
  ready: { label: '수집됨', color: 'text-emerald-600 dark:text-emerald-400' },
}

function getPlatformStatus(): PlatformStatusKey {
  return 'ready'
}

interface AnalysisHubViewProps {
  onSelect: (v: Video) => void
  addToast: AddToast
}

export function AnalysisHubView({ onSelect, addToast }: AnalysisHubViewProps) {
  const [activePlatform, setActivePlatform] = useState<string>('youtube')
  const [activeFormat, setActiveFormat] = useState<ViewVideoFormat | null>(null)

  const platform = PLATFORMS.find(p => p.id === activePlatform) ?? PLATFORMS[0]
  const hasSubFormats = (platform.subFormats?.length ?? 0) > 1

  const handlePlatformChange = useCallback((id: string) => {
    setActivePlatform(id)
    setActiveFormat(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* ── 플랫폼 선택 (데스크탑: 탭 / 모바일: 콤보박스) ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* 모바일 콤보박스 */}
        <div className="sm:hidden px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
            플랫폼 선택
          </label>
          <select
            value={activePlatform}
            onChange={e => handlePlatformChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PLATFORMS.map(p => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.label}{p.badge ? ` (${p.badge})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 데스크탑 탭 */}
        <div className="hidden sm:flex overflow-x-auto scrollbar-none">
          {PLATFORMS.map(p => {
            const isActive = p.id === activePlatform
            const status = getPlatformStatus()
            const statusMeta = PLATFORM_STATUS[status]
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePlatformChange(p.id)}
                className={`
                  relative flex-shrink-0 flex flex-col items-center gap-0.5 px-5 py-3.5 text-sm font-medium transition border-b-2
                  ${isActive
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }
                `}
              >
                <span className="text-lg leading-none">{p.icon}</span>
                <span className="whitespace-nowrap text-xs font-semibold mt-0.5">{p.label}</span>
                <span className={`text-[9px] font-medium ${statusMeta.color}`}>
                  {p.badge ?? statusMeta.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* 현재 플랫폼 서브 포맷 탭 (Shorts/롱폼 등) */}
        {hasSubFormats && (
          <div className="flex border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-1.5 gap-1">
            {platform.subFormats!.map(fmt => (
              <button
                key={String(fmt.value)}
                type="button"
                onClick={() => setActiveFormat(fmt.value)}
                className={`
                  px-3 py-1 text-xs font-semibold rounded-lg transition
                  ${activeFormat === fmt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                  }
                `}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <PlatformView
        key={`${activePlatform}-${activeFormat ?? 'all'}`}
        filter={activePlatform}
        videoFormat={activeFormat ?? undefined}
        mineOnly={false}
        onSelect={onSelect}
        addToast={addToast}
      />
    </div>
  )
}
