'use client'

import { useEffect, useState } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import { getPlatformIcon } from '@/lib/dashboard/dashboard-helpers'
import {
  fetchCalendarItems,
  saveCalendarItems,
  type CalendarItemStored,
} from '@/lib/dashboard/dashboard-storage'
import { useWorkspaceSeed } from '@/components/dashboard/hooks/use-workspace-seed'

const STATUS_CONFIG = {
  scheduled: { label: '예약됨', color: 'bg-blue-100 text-blue-700' },
  draft: { label: '초안', color: 'bg-yellow-100 text-yellow-700' },
  idea: { label: '아이디어', color: 'bg-gray-100 text-gray-600' },
  done: { label: '완료', color: 'bg-green-100 text-green-700' },
}

export default function CalendarView({ addToast }: { addToast: AddToast }) {
  const seeded = useWorkspaceSeed()
  const [items, setItems] = useState<CalendarItemStored[]>([])

  useEffect(() => {
    if (!seeded) return
    fetchCalendarItems()
      .then(setItems)
      .catch(() => addToast('캘린더 로드 실패', 'warning'))
  }, [seeded, addToast])

  const persist = (next: CalendarItemStored[]) => {
    setItems(next)
    saveCalendarItems(next).catch(() => addToast('저장 실패', 'warning'))
  }

  const markDone = (id: string) => {
    persist(items.map((item) => (item.id === id ? { ...item, status: 'done' as const } : item)))
    addToast('업로드 완료로 표시했습니다', 'success')
  }

  const addIdea = () => {
    const id = `cal-${Date.now()}`
    persist([
      {
        id,
        day: '신규',
        title: '새 콘텐츠 아이디어',
        platform: 'youtube',
        status: 'idea',
        time: '미정',
      },
      ...items,
    ])
    addToast('일정이 추가되었습니다', 'success')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
        내가 운영하는 콘텐츠의 <strong className="font-medium text-gray-800 dark:text-gray-200">제작·업로드 일정</strong>을
        관리합니다. Outlier에서 시드된 항목을 수정하거나 «+ 일정 추가»로 새 일정을 등록하세요.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '이번 주 예약', count: items.filter((i) => i.status === 'scheduled').length, color: 'bg-blue-50 text-blue-600' },
          { label: '초안 작성 중', count: items.filter((i) => i.status === 'draft').length, color: 'bg-yellow-50 text-yellow-600' },
          { label: '아이디어', count: items.filter((i) => i.status === 'idea').length, color: 'bg-gray-50 text-gray-600' },
        ].map((s) => (
          <div key={s.label} className={`${s.color.split(' ')[0]} rounded-2xl p-5`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.count}건</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">이번 주 스케줄</h3>
          <button
            type="button"
            onClick={addIdea}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            + 일정 추가
          </button>
        </div>
        {!seeded ? (
          <p className="p-8 text-center text-sm text-gray-400">준비 중…</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            Outlier 기반 초안이 없습니다. «+ 일정 추가»로 등록하세요.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map((item) => {
              const s = STATUS_CONFIG[item.status]
              const isDone = item.status === 'done'
              return (
                <div
                  key={item.id}
                  className={`p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${isDone ? 'opacity-50' : ''}`}
                >
                  <div className="text-center shrink-0 w-14">
                    <p className="text-xs font-bold text-blue-600">{item.day}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                  <span className="text-xl shrink-0">{getPlatformIcon(item.platform)}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium text-gray-900 dark:text-white truncate ${isDone ? 'line-through' : ''}`}
                    >
                      {item.title}
                    </p>
                    <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-full ${s.color}`}>{s.label}</span>
                  </div>
                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => markDone(item.id)}
                      className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition shrink-0"
                    >
                      완료
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">
        일정은 Supabase에 저장됩니다 · «내 채널» 운영 콘텐츠 기준 (Outlier 2x+ 영상으로 첫 시드)
      </p>
    </div>
  )
}
