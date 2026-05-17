'use client'
import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard-types'
import { COLLECT_JOBS, COLLECT_LOGS } from '@/lib/dummy-data'
import { getPlatformIcon } from '@/lib/dashboard-helpers'

const STATUS_COLOR = { success: 'bg-green-100 text-green-700', warning: 'bg-yellow-100 text-yellow-700', idle: 'bg-gray-100 text-gray-500', error: 'bg-red-100 text-red-700', running: 'bg-blue-100 text-blue-700' }
const STATUS_LABEL = { success: '정상', warning: '경고', idle: '대기', error: '오류', running: '수집 중' }

export default function DataCollectView({ addToast }: { addToast: AddToast }) {
  const [jobs, setJobs] = useState(COLLECT_JOBS)
  const [running, setRunning] = useState<number | null>(null)

  const runJob = (id: number) => {
    if (running !== null) return
    setRunning(id)
    addToast('데이터 수집을 시작합니다...', 'info')
    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'success', lastRun: '방금 전', count: j.count + Math.floor(Math.random() * 20 + 5) } : j))
      setRunning(null)
      addToast('수집 완료! 새 데이터가 추가되었습니다 ✅', 'success')
    }, 2000)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">수집 작업 목록</h3>
          <button onClick={() => { if (running === null) runJob(jobs[0].id) }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">전체 실행</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {jobs.map(job => {
            const isRunning = running === job.id
            const st = (isRunning ? 'running' : job.status) as keyof typeof STATUS_COLOR
            return (
              <div key={job.id} className="p-5 flex items-center gap-4">
                <span className="text-xl">{getPlatformIcon(job.platform)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{job.name}</p>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-400 mt-1">
                    <span>마지막: {job.lastRun}</span>
                    <span>수집량: {job.count}개</span>
                    <span>다음: {job.next}</span>
                  </div>
                </div>
                <button onClick={() => runJob(job.id)} disabled={isRunning}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition shrink-0 ${isRunning ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {isRunning ? '수집 중...' : '▶ 실행'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">📋 최근 수집 로그</h3>
        <div className="space-y-2">
          {COLLECT_LOGS.map((log, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-xs text-gray-400 shrink-0 w-10">{log.time}</span>
              <span className="shrink-0">{log.type === 'success' ? '✅' : log.type === 'warning' ? '⚠️' : '❌'}</span>
              <span className="text-gray-600 dark:text-gray-300">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
