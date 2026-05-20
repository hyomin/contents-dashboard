'use client'
import { useState, useEffect } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import {
  fetchRepurposeItems,
  saveRepurposeItems,
  seedRepurposeFromOutliers,
  type RepurposeItemStored,
} from '@/lib/dashboard-storage'
import { useWorkspaceSeed } from '@/components/dashboard/hooks/use-workspace-seed'
import { TitleWithHint } from '@/components/dashboard/info-hint'

const STATUS_STYLE = {
  done:     { label: '완료',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  progress: { label: '진행 중', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500 animate-pulse' },
  pending:  { label: '대기',    bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-300' },
}

export default function RepurposeView({ addToast }: { addToast: AddToast }) {
  const seeded = useWorkspaceSeed()
  const [items, setItems] = useState<RepurposeItemStored[]>([])
  const [expanded, setExpanded] = useState<string[]>([])

  useEffect(() => {
    if (!seeded) return
    fetchRepurposeItems()
      .then((list) => {
        setItems(list)
        if (list[0]) setExpanded([list[0].id])
      })
      .catch(() => addToast('Repurpose 로드 실패', 'warning'))
  }, [seeded, addToast])

  const persist = (next: RepurposeItemStored[]) => {
    setItems(next)
    saveRepurposeItems(next).catch(() => addToast('저장 실패', 'warning'))
  }

  const toggleExpand = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const updateStatus = (itemId: string, taskPlatform: string, newStatus: 'done' | 'progress' | 'pending') => {
    persist(items.map(item =>
      item.id === itemId
        ? { ...item, tasks: item.tasks.map(t => t.platform === taskPlatform ? { ...t, status: newStatus } : t) }
        : item
    ))
    const label = STATUS_STYLE[newStatus].label
    addToast(`상태를 "${label}"으로 변경했습니다`, newStatus === 'done' ? 'success' : 'info')
  }

  const totalTasks    = items.flatMap(i => i.tasks).length
  const doneTasks     = items.flatMap(i => i.tasks).filter(t => t.status === 'done').length
  const progressTasks = items.flatMap(i => i.tasks).filter(t => t.status === 'progress').length

  return (
    <div className="space-y-6">
      {/* 상단 배너 */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-6 text-white">
        <TitleWithHint
          as="h2"
          className="text-lg font-bold"
          hintVariant="light"
          hint="vs.Avg 2.0x 이상 Outlier 영상을 멀티 플랫폼으로 재가공하는 OSMU 작업 목록입니다. 진행 상태는 Supabase에 저장됩니다."
        >
          🔄 Repurposing 현황
        </TitleWithHint>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '전체 재가공 작업', value: totalTasks,                     icon: '📋', bg: 'bg-gray-50',    accent: 'text-gray-700' },
          { label: '완료',             value: doneTasks,                       icon: '✅', bg: 'bg-green-50',  accent: 'text-green-600' },
          { label: '진행 중',          value: progressTasks,                   icon: '⚙️', bg: 'bg-blue-50',   accent: 'text-blue-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><span>{c.icon}</span></div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* OSMU 플로우 다이어그램 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">📐 OSMU 재가공 흐름</h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {[
            { label: '원본 영상', sub: 'YouTube 롱폼', icon: '🔴', color: 'bg-red-50 border-red-200' },
            { label: '→', sub: '', icon: '', color: '' },
            { label: 'Shorts', sub: '1분 요약', icon: '🎬', color: 'bg-orange-50 border-orange-200' },
            { label: '→', sub: '', icon: '', color: '' },
            { label: '카드뉴스', sub: 'Instagram', icon: '💗', color: 'bg-pink-50 border-pink-200' },
            { label: '→', sub: '', icon: '', color: '' },
            { label: '블로그', sub: 'Naver / Tistory', icon: '✍️', color: 'bg-green-50 border-green-200' },
          ].map((step, i) =>
            step.icon ? (
              <div key={i} className={`${step.color} border rounded-xl px-4 py-3 text-center min-w-[90px]`}>
                <span className="text-xl">{step.icon}</span>
                <p className="text-xs font-bold text-gray-700 mt-1">{step.label}</p>
                <p className="text-xs text-gray-400">{step.sub}</p>
              </div>
            ) : (
              <span key={i} className="text-gray-300 text-xl font-light">→</span>
            )
          )}
        </div>
      </div>

      {/* 아이템 목록 */}
      <div className="space-y-3">
        {items.map(item => {
          const isOpen = expanded.includes(item.id)
          const done = item.tasks.filter(t => t.status === 'done').length
          return (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <button onClick={() => toggleExpand(item.id)} className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left">
                <span className="text-xl">🔴</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.sourceTitle}</p>
                  <p className="text-xs text-gray-400 mt-0.5">vs.Avg {item.sourceVsAvg}x · 재가공 {done}/{item.tasks.length} 완료</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(done / item.tasks.length) * 100}%` }} />
                  </div>
                  <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
                  {item.tasks.map(task => {
                    const s = STATUS_STYLE[task.status]
                    return (
                      <div key={task.platform} className="px-5 py-4 flex items-center gap-4">
                        <span className="text-xl shrink-0">{task.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{task.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{task.notes}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium ${s.bg} ${s.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          <select value={task.status} onChange={e => updateStatus(item.id, task.platform, e.target.value as 'done' | 'progress' | 'pending')}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="pending">대기</option>
                            <option value="progress">진행 중</option>
                            <option value="done">완료</option>
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={async () => {
          const res = await fetch('/api/dashboard/workspace-seed')
          const data = await res.json()
          const seededItems = seedRepurposeFromOutliers(data.outliers ?? [])
          if (seededItems.length === 0) {
            addToast('추가할 Outlier가 없습니다', 'warning')
            return
          }
          const first = seededItems[0]
          persist([first, ...items.filter((i) => i.id !== first.id)])
          addToast('Outlier 콘텐츠를 Repurposing 목록에 추가했습니다', 'success')
        }}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition"
      >
        + Outlier 콘텐츠 추가
      </button>
    </div>
  )
}
