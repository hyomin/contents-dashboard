'use client'
import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import { CALENDAR_ITEMS } from '@/lib/dummy-data'
import { getPlatformIcon } from '@/lib/dashboard-helpers'

const STATUS_CONFIG = {
  scheduled: { label: '예약됨',  color: 'bg-blue-100 text-blue-700' },
  draft:      { label: '초안',    color: 'bg-yellow-100 text-yellow-700' },
  idea:       { label: '아이디어', color: 'bg-gray-100 text-gray-600' },
  done:       { label: '완료',    color: 'bg-green-100 text-green-700' },
}

export default function CalendarView({ addToast }: { addToast: AddToast }) {
  const [items, setItems] = useState(CALENDAR_ITEMS)

  const markDone = (id: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'done' } : item))
    addToast('업로드 완료로 표시했습니다 ✅', 'success')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '이번 주 예약', count: items.filter(i => i.status === 'scheduled').length, color: 'bg-blue-50 text-blue-600' },
          { label: '초안 작성 중', count: items.filter(i => i.status === 'draft').length,     color: 'bg-yellow-50 text-yellow-600' },
          { label: '아이디어',     count: items.filter(i => i.status === 'idea').length,      color: 'bg-gray-50 text-gray-600' },
        ].map(s => (
          <div key={s.label} className={`${s.color.split(' ')[0]} rounded-2xl p-5`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.count}건</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">이번 주 스케줄</h3>
          <button onClick={() => addToast('콘텐츠 일정 추가 기능 준비 중', 'info')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">+ 일정 추가</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map(item => {
            const s = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]
            const isDone = item.status === 'done'
            return (
              <div key={item.id} className={`p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${isDone ? 'opacity-50' : ''}`}>
                <div className="text-center shrink-0 w-14">
                  <p className="text-xs font-bold text-blue-600">{item.day}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
                <span className="text-xl shrink-0">{getPlatformIcon(item.platform)}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${isDone ? 'line-through' : ''}`}>{item.title}</p>
                  <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-full ${s.color}`}>{s.label}</span>
                </div>
                {!isDone && (
                  <button onClick={() => markDone(item.id)} className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition shrink-0">완료</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
