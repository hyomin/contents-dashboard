'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import type { N8nAutomationService } from '@/lib/n8n/research-roadmap'
import {
  getCategoryLabel,
  getStatusLabel,
  getWorkflowImplementationMeta,
  getWorkflowImplementationStatus,
  isWorkflowRunnable,
} from '@/lib/n8n/research-roadmap'
import { getWorkflowDeployMeta } from '@/lib/n8n/deploy-status'
import { getLiveWorkflowByPath } from '@/lib/n8n/live-workflows'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface N8nLv1ServicePanelProps {
  service: N8nAutomationService
  addToast: AddToast
  defaultExpanded?: boolean
  compact?: boolean
  /** n8n-status 의 activeWebhookPaths */
  activeWebhookPaths?: ReadonlySet<string>
}

export function N8nLv1ServicePanel({
  service,
  addToast,
  defaultExpanded = service.status === 'next',
  compact = false,
  activeWebhookPaths = new Set(),
}: N8nLv1ServicePanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [topicInput, setTopicInput] = useState('금리 동결 이후 재테크')

  const implStatus = getWorkflowImplementationStatus(service, activeWebhookPaths)
  const implMeta = getWorkflowImplementationMeta(implStatus)
  const deployMeta = getWorkflowDeployMeta(service)
  const isRunnable = isWorkflowRunnable(service, activeWebhookPaths)
  const isN8nLive = activeWebhookPaths.has(service.webhookPath)
  const liveWorkflow = getLiveWorkflowByPath(service.webhookPath)

  const implBadgeClass =
    implStatus === 'implemented'
      ? 'bg-emerald-600 text-white ring-2 ring-emerald-200 dark:ring-emerald-900'
      : implStatus === 'partial'
        ? 'bg-amber-500 text-white ring-2 ring-amber-200 dark:ring-amber-900'
        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'

  const cardShellClass =
    implStatus === 'implemented'
      ? 'border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/25 shadow-sm shadow-emerald-100/50 dark:shadow-none'
      : implStatus === 'partial'
        ? 'border-2 border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20'
        : 'border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 opacity-[0.92]'

  const statusBadgeClass =
    service.status === 'done'
      ? 'bg-gray-900 text-emerald-400'
      : service.status === 'next'
        ? 'bg-emerald-100 text-emerald-800'
        : service.status === 'soon'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-blue-100 text-blue-800'

  const runService = async () => {
    if (!isRunnable) {
      addToast('미구현 워크플로입니다. 로드맵에서 설계 후 연동 예정입니다', 'info')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      if (service.integrationMode === 'api' && service.api) {
        const res = await fetch(service.api.path, {
          method: service.api.method,
          ...(service.api.method === 'POST'
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
            : {}),
        })
        const data = await res.json()
        if (!res.ok) {
          addToast(data.error ?? '실행 실패', 'warning')
          setResult(JSON.stringify(data, null, 2))
          return
        }
        if (service.id === 'channel-vs-avg' || service.id === 'multi-channel-collect') {
          addToast(data.message ?? '수집을 실행했습니다', data.ok ? 'success' : 'warning')
        } else {
          addToast('조회 완료', 'success')
        }
        setResult(JSON.stringify(data, null, 2))
        return
      }

      const body: Record<string, unknown> = {
        ...(service.samplePayload ?? {}),
      }
      if (service.id === 'longform-script') {
        body.topic = topicInput.trim() || '주제 미입력'
      }

      if (service.integrationMode === 'hybrid' && service.api) {
        const listRes = await fetch(service.api.path)
        const listData = await listRes.json()
        if (listRes.ok) {
          body.existingOutlierCount = Array.isArray(listData) ? listData.length : 0
        }
      }

      const res = await fetch(`/api/n8n/lv1-services/${service.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))
      if (data.mode === 'n8n') {
        addToast(`n8n «${service.n8nScenarioName}» 실행 완료`, 'success')
      } else {
        addToast(
          typeof data.message === 'string'
            ? data.message.slice(0, 100)
            : `«${service.n8nScenarioName}» 더미 응답`,
          'info',
        )
      }
    } catch (e) {
      setResult(JSON.stringify({ error: String(e) }, null, 2))
      addToast('실행 중 오류', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const goToLinkedView = () => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', service.linkedViewId)
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className={compact ? '' : 'mb-4'}>
      <div className={`rounded-2xl ${cardShellClass} ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${implBadgeClass}`}
                title={implMeta.hint}
              >
                {implStatus === 'implemented' && '● '}
                {implStatus === 'partial' && '◐ '}
                {implStatus === 'unimplemented' && '○ '}
                {implMeta.label}
              </span>
              <span className="text-[10px] font-mono text-gray-400">#{service.researchNo}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass}`}>
                {getStatusLabel(service.status)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {service.researchLevel.toUpperCase()}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">
                {getCategoryLabel(service.category)}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  deployMeta.kind === 'dashboard-api'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                    : deployMeta.kind === 'n8n-json'
                      ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                      : deployMeta.kind === 'n8n-hybrid'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
                title={deployMeta.hint}
              >
                {deployMeta.label}
              </span>
            </div>
            <TitleWithHint
              as="h3"
              className={`font-semibold text-sm ${
                implStatus === 'unimplemented'
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-900 dark:text-white'
              }`}
              hint={`${implMeta.hint} ${service.description}`}
            >
              {service.n8nScenarioName}
            </TitleWithHint>
            {!compact && (
              <p className="text-xs text-gray-500 mt-1">{service.expectedEffect}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={runService}
              disabled={loading || !isRunnable}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                !isRunnable
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                  : implStatus === 'implemented'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {loading
                ? '실행 중…'
                : !isRunnable
                  ? '미구현'
                  : isN8nLive
                    ? '▶ n8n 실행'
                    : implStatus === 'partial'
                      ? service.integrationMode === 'api'
                        ? '▶ 대시보드 API'
                        : '▶ 미리보기'
                      : '▶ 서비스 실행'}
            </button>
            <button
              type="button"
              onClick={goToLinkedView}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              연결 화면
            </button>
          </div>
        </div>

        {service.id === 'longform-script' && (
          <label className="block mt-3">
            <span className="text-xs font-medium text-gray-500">주제 키워드</span>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              placeholder="예: 금리 동결 이후 재테크"
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline"
        >
          {expanded ? '▲ n8n 시나리오 정보 숨기기' : '▼ n8n 시나리오 정보 보기'}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-600 space-y-2 text-xs">
            <DetailRow label="n8n 시나리오 (자동화 이름)" value={service.n8nScenarioName} highlight />
            <DetailRow label="Webhook path" value={`/webhook/${service.webhookPath}`} mono />
            {service.envWebhookKey && (
              <DetailRow
                label=".env (연동 시)"
                value={`${service.envWebhookKey}=http://localhost:5678/webhook/${service.webhookPath}`}
                mono
              />
            )}
            {liveWorkflow && (
              <DetailRow
                label="n8n 현행 워크플로"
                value={`${liveWorkflow.name} (${liveWorkflow.triggers.join(' · ')})`}
                highlight
              />
            )}
            {service.n8nWorkflowFile && (
              <DetailRow label="레포 JSON" value={`docs/n8n/workflows/${service.n8nWorkflowFile}`} mono />
            )}
            <DetailRow label="핵심 노드" value={service.coreNodes} />
            <DetailRow label="연동 방식" value={integrationLabel(service)} />
            {service.api && (
              <DetailRow label="대시보드 API" value={`${service.api.method} ${service.api.path}`} mono />
            )}
            <p className="text-gray-500 pt-1">
              n8n에서 위 이름으로 워크플로를 만들고 Webhook을 활성화한 뒤, 운영 시에는 «서비스 실행»만 사용하면
              됩니다 (편집기 로그인 불필요).
            </p>
          </div>
        )}

        {result && (
          <pre className="mt-3 p-3 text-[10px] font-mono bg-gray-900 text-gray-100 rounded-xl overflow-x-auto max-h-48">
            {result}
          </pre>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`${mono ? 'font-mono text-[11px]' : ''} ${
          highlight ? 'font-semibold text-violet-700 dark:text-violet-300' : 'text-gray-800 dark:text-gray-200'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function integrationLabel(service: N8nAutomationService): string {
  switch (service.integrationMode) {
    case 'api':
      return '대시보드 API (기존 구현)'
    case 'hybrid':
      return 'API 조회 + n8n Webhook 태깅 (env 설정 시 n8n)'
    case 'n8n':
      return 'n8n Webhook 전용'
    case 'roadmap':
      return '로드맵 (n8n 시나리오 설계·연동 예정)'
    default:
      return '더미 미리보기 (n8n Webhook 준비 후 env 연동)'
  }
}
