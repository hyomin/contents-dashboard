'use client'
import { useState } from 'react'
import type { AddToast } from '@/lib/dashboard-types'

interface DeployTask {
  id: number
  title: string
  platform: string
  icon: string
  scheduledAt: string
  status: 'scheduled' | 'published' | 'failed' | 'draft'
  channel: string
  auto: boolean
}

const DEPLOY_TASKS: DeployTask[] = [
  { id: 1, title: '금리 인상 시대의 재테크 전략',   platform: 'youtube',    icon: '🔴', scheduledAt: '오늘 오후 6:00',  status: 'scheduled', channel: '내 유튜브', auto: true },
  { id: 2, title: '부동산 투자 완벽 가이드 (블로그)',platform: 'naver-blog', icon: '🟢', scheduledAt: '내일 오전 9:00',  status: 'scheduled', channel: '내 블로그', auto: true },
  { id: 3, title: '주식 투자 인스타 카드뉴스',       platform: 'instagram',  icon: '💗', scheduledAt: '내일 오전 11:00', status: 'draft',     channel: '내 인스타', auto: false },
  { id: 4, title: '경제 뉴스 Shorts',               platform: 'youtube',    icon: '🔴', scheduledAt: '2일 후 오후 7:00', status: 'scheduled', channel: '내 유튜브', auto: true },
  { id: 5, title: '재테크 티스토리 포스팅',           platform: 'tistory',    icon: '🟠', scheduledAt: '어제 오전 10:00', status: 'published', channel: '내 티스토리', auto: false },
  { id: 6, title: '연금 분석 영상 Shorts',           platform: 'youtube',    icon: '🔴', scheduledAt: '어제 오후 5:00',  status: 'failed',    channel: '내 유튜브', auto: true },
]

const WEBHOOKS = [
  { id: 1, name: 'n8n → YouTube 업로드',    status: 'active',   lastRun: '2시간 전',  icon: '🔴', runs: 42 },
  { id: 2, name: 'n8n → Naver Blog 포스팅', status: 'active',   lastRun: '1일 전',    icon: '🟢', runs: 18 },
  { id: 3, name: 'n8n → Instagram 게시',    status: 'inactive', lastRun: '미연동',    icon: '💗', runs: 0 },
  { id: 4, name: 'n8n → Tistory 포스팅',    status: 'inactive', lastRun: '미연동',    icon: '🟠', runs: 0 },
]

const STATUS_STYLE = {
  scheduled: { label: '예약됨',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  published: { label: '게시 완료', bg: 'bg-green-100',  text: 'text-green-700' },
  failed:    { label: '실패',      bg: 'bg-red-100',    text: 'text-red-700' },
  draft:     { label: '초안',      bg: 'bg-gray-100',   text: 'text-gray-500' },
}

export default function DeployView({ addToast }: { addToast: AddToast }) {
  const [tasks, setTasks] = useState(DEPLOY_TASKS)
  const [deploying, setDeploying] = useState<number | null>(null)

  const retryFailed = (id: number) => {
    setDeploying(id)
    addToast('재시도 중...', 'info')
    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'published' } : t))
      setDeploying(null)
      addToast('배포 성공! 게시 완료', 'success')
    }, 1800)
  }

  const publishDraft = (id: number) => {
    setDeploying(id)
    addToast('배포 중...', 'info')
    setTimeout(() => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'scheduled' } : t))
      setDeploying(null)
      addToast('예약 배포가 등록되었습니다 ✅', 'success')
    }, 1500)
  }

  const scheduled = tasks.filter(t => t.status === 'scheduled').length
  const published  = tasks.filter(t => t.status === 'published').length
  const failed     = tasks.filter(t => t.status === 'failed').length

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold mb-1">📤 배포 자동화</h2>
        <p className="text-sm opacity-80">n8n 기반 멀티채널 자동 배포 현황</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '예약 배포',  value: scheduled, icon: '📅', bg: 'bg-blue-50',  accent: 'text-blue-600' },
          { label: '게시 완료',  value: published,  icon: '✅', bg: 'bg-green-50', accent: 'text-green-600' },
          { label: '실패',        value: failed,    icon: '❌', bg: 'bg-red-50',   accent: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-2xl p-5`}>
            <div className="flex justify-between mb-2"><span className="text-xs text-gray-500">{c.label}</span><span>{c.icon}</span></div>
            <p className={`text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Webhook 연결 현황 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">⚙️ n8n Webhook 연결 현황</h3>
          <button onClick={() => addToast('n8n 워크플로우 동기화 완료', 'success')} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">동기화</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {WEBHOOKS.map(wh => (
            <div key={wh.id} className="p-4 flex items-center gap-4">
              <span className="text-xl">{wh.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{wh.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">마지막 실행: {wh.lastRun} · 총 {wh.runs}회</p>
              </div>
              <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${wh.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {wh.status === 'active' ? '● 활성' : '○ 비활성'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 배포 스케줄 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white">배포 스케줄</h3>
          <button onClick={() => addToast('새 배포 일정을 추가합니다', 'info')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">+ 배포 추가</button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {tasks.map(task => {
            const s = STATUS_STYLE[task.status]
            const isDeploying = deploying === task.id
            return (
              <div key={task.id} className="p-5 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <span className="text-xl shrink-0">{task.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                    {task.auto && <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">자동</span>}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>{task.channel}</span>
                    <span>·</span>
                    <span>{task.scheduledAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                  {task.status === 'failed' && (
                    <button onClick={() => retryFailed(task.id)} disabled={isDeploying}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${isDeploying ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                      {isDeploying ? '재시도 중...' : '재시도'}
                    </button>
                  )}
                  {task.status === 'draft' && (
                    <button onClick={() => publishDraft(task.id)} disabled={isDeploying}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${isDeploying ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                      {isDeploying ? '배포 중...' : '예약 배포'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
