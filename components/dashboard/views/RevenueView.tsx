'use client'
import type { AddToast } from '@/lib/dashboard-types'
import { REVENUE_DATA, MONTHLY_GOAL } from '@/lib/dummy-data'
import { getPlatformIcon } from '@/lib/dashboard-helpers'

export default function RevenueView({ addToast }: { addToast: AddToast }) {
  const totalMonthly = REVENUE_DATA.reduce((s, r) => s + r.monthly, 0)
  const progress = Math.min((totalMonthly / MONTHLY_GOAL) * 100, 100)

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-6 text-white">
        <p className="text-sm opacity-80 mb-1">이번 달 수익</p>
        <p className="text-4xl font-black">₩{totalMonthly.toLocaleString()}</p>
        <div className="mt-4">
          <div className="flex justify-between text-sm opacity-80 mb-1">
            <span>목표 ₩{MONTHLY_GOAL.toLocaleString()}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="bg-white/30 rounded-full h-2">
            <div className="bg-white h-2 rounded-full" style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
        </div>
        <p className="text-xs opacity-70 mt-3">💡 수익은 채널 운영 시작 후 자동 연동 예정</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REVENUE_DATA.map(r => (
          <div key={r.platform} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getPlatformIcon(r.platform)}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.label}</span>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {r.status === 'active' ? '활성' : '준비 중'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900 dark:text-white">₩{r.monthly.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">이번 달</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-400">{r.rpm > 0 ? `₩${r.rpm.toLocaleString()}` : '-'}</p>
                <p className="text-xs text-gray-400 mt-0.5">예상 RPM</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>월 목표 ₩{r.goal.toLocaleString()}</span>
                <span>{r.monthly > 0 ? ((r.monthly / r.goal) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${r.monthly > 0 ? 'bg-green-500' : 'bg-gray-300'}`} style={{ width: `${Math.max((r.monthly / r.goal) * 100, 2)}%` }} />
              </div>
            </div>
            <button onClick={() => addToast(`${r.label} 수익 데이터 업데이트 (더미)`, 'info')} className="w-full mt-4 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-xl transition">수동 업데이트</button>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">🗺️ 수익화 로드맵</h3>
        <div className="space-y-3">
          {[
            { step: 1, label: 'YouTube 1,000 구독자 달성',          target: '2026 Q4' },
            { step: 2, label: 'YPP 신청 (4,000시간 시청)',           target: '2027 Q1' },
            { step: 3, label: '네이버 AdPost 신청 (일 방문 100+)',   target: '2027 Q1' },
            { step: 4, label: '티스토리 AdSense 연동',               target: '2026 Q3' },
            { step: 5, label: '월 50만원 수익 달성',                 target: '2027 Q2' },
          ].map(r => (
            <div key={r.step} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">{r.step}</span>
              <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">{r.label}</p>
              <span className="text-xs text-gray-400 shrink-0">{r.target}</span>
              <button onClick={() => addToast(`${r.label} 목표 달성!`, 'success')} className="text-xs px-2 py-1 bg-gray-100 hover:bg-green-100 hover:text-green-700 text-gray-500 rounded-lg transition">완료</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
