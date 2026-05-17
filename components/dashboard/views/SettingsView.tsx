'use client'

import { useTheme } from '@/lib/theme'
import type { AddToast } from '@/lib/dashboard-types'

type ThemeOption = { value: 'light' | 'dark' | 'system'; label: string; icon: string; desc: string }

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light',  label: 'Light',  icon: '☀️', desc: '밝은 흰색 배경' },
  { value: 'dark',   label: 'Dark',   icon: '🌙', desc: '어두운 검정 배경' },
  { value: 'system', label: 'System', icon: '💻', desc: '운영체제 설정 따라가기' },
]

export default function SettingsView({ addToast }: { addToast: AddToast }) {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const handleSelect = (value: 'light' | 'dark' | 'system') => {
    setTheme(value)
    const label = THEME_OPTIONS.find(o => o.value === value)?.label ?? value
    addToast(`테마가 ${label}으로 변경됐습니다`, 'success')
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* 테마 설정 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="mb-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">🎨 테마</h3>
          <p className="text-sm text-gray-500 mt-1">
            현재 적용 중: <span className="font-semibold text-gray-700 dark:text-gray-300">{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(opt => {
            const isActive = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition
                  ${isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                {/* 모드 미리보기 */}
                <div className={`w-full h-16 rounded-lg border overflow-hidden flex
                  ${opt.value === 'dark' ? 'bg-gray-900 border-gray-700' :
                    opt.value === 'light' ? 'bg-white border-gray-200' :
                    'bg-gradient-to-r from-white to-gray-900 border-gray-300'
                  }`}
                >
                  <div className={`w-1/3 h-full ${opt.value === 'dark' ? 'bg-gray-800' : opt.value === 'light' ? 'bg-gray-100' : 'bg-gray-100'}`} />
                  <div className="flex-1 p-2 space-y-1">
                    <div className={`h-1.5 rounded w-3/4 ${opt.value === 'dark' ? 'bg-gray-600' : 'bg-gray-200'}`} />
                    <div className={`h-1.5 rounded w-1/2 ${opt.value === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`} />
                  </div>
                </div>

                <div className="text-center">
                  <span className="text-xl">{opt.icon}</span>
                  <p className={`text-sm font-semibold mt-1 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </div>

                {isActive && (
                  <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* 시스템 정보 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">ℹ️ 시스템 정보</h3>
        <div className="space-y-3 text-sm">
          {[
            { label: '대시보드 버전', value: 'v0.1.0' },
            { label: '데이터베이스', value: 'Supabase (PostgreSQL)' },
            { label: '자동화 엔진', value: 'n8n' },
            { label: '프레임워크', value: 'Next.js 15 (App Router)' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
