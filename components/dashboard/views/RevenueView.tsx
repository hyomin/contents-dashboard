'use client'

import { useEffect, useState } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import { getPlatformIcon } from '@/lib/dashboard-helpers'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface PlatformRevenue {
  platform: string
  label: string
  monthly: number
  rpm: number
  totalViews: number
  status: string
  goal: number
}

export default function RevenueView({ addToast }: { addToast: AddToast }) {
  const [platforms, setPlatforms] = useState<PlatformRevenue[]>([])
  const [monthlyGoal, setMonthlyGoal] = useState(500000)
  const [totalMonthly, setTotalMonthly] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/revenue-estimate')
      .then((r) => r.json())
      .then((d) => {
        setPlatforms(d.platforms ?? [])
        setMonthlyGoal(d.monthlyGoal ?? 500000)
        setTotalMonthly(d.totalMonthly ?? 0)
        setNote(d.note ?? '')
      })
      .catch(() => addToast('수익 추정 로드 실패', 'warning'))
      .finally(() => setLoading(false))
  }, [addToast])

  const progress = Math.min((totalMonthly / monthlyGoal) * 100, 100)

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 text-white">
        <TitleWithHint
          as="p"
          className="text-sm opacity-80 mb-1"
          hintVariant="light"
          hint="플랫폼별 조회수와 가정 RPM을 곱한 추정치입니다. 실제 정산액과 다를 수 있습니다."
        >
          이번 달 추정 수익 (조회수 × RPM)
        </TitleWithHint>
        <p className="text-4xl font-black">{loading ? '…' : `₩${totalMonthly.toLocaleString()}`}</p>
        <div className="mt-4">
          <div className="flex justify-between text-sm opacity-80 mb-1">
            <span>목표 ₩{monthlyGoal.toLocaleString()}</span>
            <span>{loading ? '…' : `${progress.toFixed(0)}%`}</span>
          </div>
          <div className="bg-white/30 rounded-full h-2">
            <div className="bg-white h-2 rounded-full" style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
        </div>
        {note && <p className="text-xs opacity-70 mt-3">{note}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(loading ? [] : platforms).map((r) => (
          <div key={r.platform} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getPlatformIcon(r.platform)}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.label}</span>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {r.status === 'active' ? '데이터 있음' : '준비 중'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">₩{r.monthly.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">추정 월수익</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-400">
                  {r.rpm > 0 ? `₩${r.rpm.toLocaleString()}` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">참고 RPM</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-2">수집 조회수 합계: {r.totalViews.toLocaleString()}</p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>월 목표 ₩{r.goal.toLocaleString()}</span>
                <span>{r.monthly > 0 ? ((r.monthly / r.goal) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${r.monthly > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
                  style={{ width: `${Math.max((r.monthly / r.goal) * 100, 2)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <TitleWithHint
          as="h3"
          className="font-bold text-gray-900 dark:text-white mb-4"
          hint="플랫폼별 수익화 마일스톤 목표 일정입니다."
        >
          수익화 로드맵
        </TitleWithHint>
        <div className="space-y-3">
          {[
            { step: 1, label: 'YouTube 1,000 구독자 달성', target: '2026 Q4' },
            { step: 2, label: 'YPP 신청 (4,000시간 시청)', target: '2027 Q1' },
            { step: 3, label: '네이버 AdPost 신청', target: '2027 Q1' },
            { step: 4, label: '티스토리 AdSense 연동', target: '2026 Q3' },
            { step: 5, label: '월 50만원 수익 달성', target: '2027 Q2' },
          ].map((r) => (
            <div key={r.step} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">
                {r.step}
              </span>
              <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">{r.label}</p>
              <span className="text-xs text-gray-400 shrink-0">{r.target}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
