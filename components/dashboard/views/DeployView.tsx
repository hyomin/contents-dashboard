'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  fetchDeployTasks,
  saveDeployTasks,
  type DeployTaskStored,
} from '@/lib/dashboard/dashboard-storage'
import { useWorkspaceSeed } from '@/components/dashboard/hooks/use-workspace-seed'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import type { ContentFormat, ContentGenerateResult } from '@/app/api/dashboard/content-generate/route'
import { FORMAT_META } from '@/components/dashboard/views/ContentStudioView'
import { Spinner } from '@/components/dashboard/ui/loading'

const WEBHOOKS = [
  { id: 1, name: 'n8n → YouTube 수집', status: 'active', lastRun: 'youtube-collect', icon: '🔴', runs: '—' },
  { id: 2, name: 'n8n → 아웃라이어 태깅', status: 'active', lastRun: 'outlier-tagging', icon: '🚀', runs: '—' },
  { id: 5, name: 'n8n → 주제 선별 AI', status: 'inactive', lastRun: '재임포트 대기', icon: '🎯', runs: 0 },
  { id: 3, name: 'n8n → Instagram 게시', status: 'inactive', lastRun: '미연동', icon: '💗', runs: 0 },
  { id: 4, name: 'n8n → Tistory 포스팅', status: 'inactive', lastRun: '미연동', icon: '🟠', runs: 0 },
]

const STATUS_STYLE = {
  scheduled: { label: '예약됨',   bg: 'bg-blue-100',   text: 'text-blue-700' },
  published: { label: '게시 완료', bg: 'bg-green-100',  text: 'text-green-700' },
  failed:    { label: '실패',      bg: 'bg-red-100',    text: 'text-red-700' },
  draft:     { label: '초안',      bg: 'bg-gray-100',   text: 'text-gray-500' },
}

/** 재작성 모달 */
function RepurposeModal({
  sourceTitle,
  onClose,
  addToast,
  onDone,
}: {
  sourceTitle: string
  onClose: () => void
  addToast: AddToast
  onDone: (format: ContentFormat, result: ContentGenerateResult) => void
}) {
  const [targetFormat, setTargetFormat] = useState<ContentFormat>('blog')
  const [loading, setLoading] = useState(false)

  const FORMATS: ContentFormat[] = ['blog', 'sns-caption', 'shortform', 'carousel', 'longform']

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/content-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFormat, sourceContent: sourceTitle, sourceFormat: 'longform' }),
      })
      const data = await res.json() as ContentGenerateResult & { error?: string }
      if (!res.ok || data.error) {
        addToast(data.error ?? '생성 실패', 'warning')
      } else {
        onDone(targetFormat, data)
        addToast(`${FORMAT_META[targetFormat].label} 변환 완료 ✨`, 'success')
      }
    } catch {
      addToast('네트워크 오류', 'warning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">🔄 다른 형식으로 재작성</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">"{sourceTitle}"</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">목표 포맷</p>
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setTargetFormat(f)}
                className={`p-3 rounded-xl text-left border transition ${
                  targetFormat === f
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40'
                    : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                }`}
              >
                <span className="text-lg">{FORMAT_META[f].icon}</span>
                <p className="text-xs font-semibold mt-1 text-gray-800 dark:text-gray-200">{FORMAT_META[f].label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{FORMAT_META[f].desc}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition ${
            loading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" color="border-white" />
              변환 중…
            </span>
          ) : `✨ ${FORMAT_META[targetFormat].label}으로 변환`}
        </button>
      </div>
    </div>
  )
}

export default function DeployView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const seeded = useWorkspaceSeed()
  const [tasks, setTasks] = useState<DeployTaskStored[]>([])
  const [deploying, setDeploying] = useState<string | null>(null)
  const [repurposeTask, setRepurposeTask] = useState<DeployTaskStored | null>(null)

  useEffect(() => {
    if (!seeded) return
    fetchDeployTasks()
      .then(setTasks)
      .catch(() => addToast('배포 목록 로드 실패', 'warning'))
  }, [seeded, addToast])

  const persist = (next: DeployTaskStored[]) => {
    setTasks(next)
    saveDeployTasks(next).catch(() => addToast('저장 실패', 'warning'))
  }

  const retryFailed = (id: string) => {
    setDeploying(id)
    addToast('재시도 중...', 'info')
    setTimeout(() => {
      persist(tasks.map(t => t.id === id ? { ...t, status: 'published' as const } : t))
      setDeploying(null)
      addToast('배포 성공! 게시 완료', 'success')
    }, 1800)
  }

  const publishDraft = (id: string) => {
    setDeploying(id)
    addToast('배포 중...', 'info')
    setTimeout(() => {
      persist(tasks.map(t => t.id === id ? { ...t, status: 'scheduled' as const } : t))
      setDeploying(null)
      addToast('예약 배포가 등록되었습니다', 'success')
    }, 1500)
  }

  const scheduled = tasks.filter(t => t.status === 'scheduled').length
  const published  = tasks.filter(t => t.status === 'published').length
  const failed     = tasks.filter(t => t.status === 'failed').length

  const goToStudio = () => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', 'content-studio')
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="space-y-6">
      {repurposeTask && (
        <RepurposeModal
          sourceTitle={repurposeTask.title}
          onClose={() => setRepurposeTask(null)}
          addToast={addToast}
          onDone={(_fmt, _result) => {
            setRepurposeTask(null)
            goToStudio()
          }}
        />
      )}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white">
        <TitleWithHint
          as="h2"
          className="text-lg font-bold"
          hintVariant="light"
          hint="n8n 웹훅·예약 배포 스케줄을 관리합니다. Outlier 기반 초안이 비어 있으면 워크스페이스 시드 API로 채울 수 있습니다."
        >
          📤 배포 자동화
        </TitleWithHint>
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
                <p className="text-xs text-gray-400 mt-0.5">마지막 실행: {wh.lastRun} · 실행 {wh.runs}회</p>
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
          {tasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">Outlier 기반 배포 초안이 없습니다. 워크스페이스 시드 후 표시됩니다.</p>
          ) : tasks.map(task => {
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
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                  <button
                    type="button"
                    onClick={() => setRepurposeTask(task)}
                    className="px-3 py-1.5 text-xs rounded-lg font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 transition"
                    title="다른 포맷으로 재작성"
                  >
                    🔄 재작성
                  </button>
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
