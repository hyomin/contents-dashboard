'use client'

import { useState, useCallback } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  getServicesByView,
  getWorkflowImplementationStatus,
  isWorkflowRunnable,
  type N8nAutomationService,
} from '@/lib/n8n/research-roadmap'
import { getLiveWorkflowByPath } from '@/lib/n8n/live-workflows'
import { N8N_SCHEDULE_INTERVAL_HOURS } from '@/lib/n8n/live-workflows'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface Props {
  viewId: string
  addToast: AddToast
  title?: string
  /** n8n-status 의 activeWebhookPaths (상위에서 전달 가능) */
  activeWebhookPaths?: ReadonlySet<string>
}

const STATUS_COLOR = {
  done:  'text-emerald-700 dark:text-emerald-400',
  next:  'text-blue-700 dark:text-blue-400',
  soon:  'text-amber-700 dark:text-amber-400',
  later: 'text-gray-500 dark:text-gray-500',
}

const STATUS_LABEL = {
  done:  '✓ 운영 중',
  next:  '▶ 다음 스텝',
  soon:  '◷ 개발 예정',
  later: '… 장기 계획',
}

function FlowRow({
  service,
  addToast,
  activeWebhookPaths,
}: {
  service: N8nAutomationService
  addToast: AddToast
  activeWebhookPaths: ReadonlySet<string>
}) {
  const [loading, setLoading] = useState(false)
  const flowNo = `F${String(service.researchNo).padStart(2, '0')}`
  const implStatus = getWorkflowImplementationStatus(service, activeWebhookPaths)
  const runnable = isWorkflowRunnable(service, activeWebhookPaths)
  const liveWf = getLiveWorkflowByPath(service.webhookPath)

  const run = useCallback(async () => {
    if (!runnable) {
      addToast(`${flowNo} ${service.n8nScenarioName}: 아직 개발 예정입니다`, 'info')
      return
    }
    setLoading(true)
    try {
      let res: Response
      if (service.integrationMode === 'api' && service.api) {
        res = await fetch(service.api.path, {
          method: service.api.method,
          ...(service.api.method === 'POST'
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(service.samplePayload ?? {}) }
            : {}),
        })
      } else {
        res = await fetch(`/api/n8n/lv1-services/${service.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'manual', ...(service.samplePayload ?? {}) }),
        })
      }
      const data = await res.json().catch(() => ({}))
      addToast(
        data.message ?? `${flowNo} ${service.n8nScenarioName} ${res.ok ? '완료' : '실패'}`,
        res.ok ? 'success' : 'warning',
      )
    } catch (e) {
      addToast(`${flowNo} 실행 오류`, 'warning')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [service, addToast, flowNo, runnable])

  return (
    <div className={`flex flex-wrap items-center gap-3 justify-between px-3 py-2.5 rounded-xl border transition ${
      implStatus === 'implemented'
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
        : implStatus === 'partial'
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10'
          : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 opacity-85'
    }`}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* 번호 */}
        <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-lg font-mono ${
          implStatus === 'implemented'
            ? 'bg-emerald-600 text-white'
            : implStatus === 'partial'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
        }`}>
          {flowNo}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold ${STATUS_COLOR[service.status]}`}>
              {STATUS_LABEL[service.status]}
            </span>
            {liveWf && (
              <span className="text-[10px] text-gray-400">⏱ {liveWf.scheduleHint}</span>
            )}
          </div>
          <p className={`text-xs font-semibold leading-tight ${
            implStatus === 'unimplemented' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'
          }`}>
            {service.n8nScenarioName}
          </p>
        </div>
      </div>

      {/* 실행 버튼 */}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        title={!runnable ? '개발 예정 — 아직 실행 불가' : `${flowNo} 수동 실행`}
        className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition disabled:opacity-60 ${
          !runnable
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            : implStatus === 'implemented'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {loading ? '⏳' : !runnable ? '🔒 예정' : `▶ 실행`}
      </button>
    </div>
  )
}

/** 각 상세 페이지 상단에 연결된 플로우 목록 + 수동 실행 버튼 */
export function N8nLv1ServicesSection({ viewId, addToast, title, activeWebhookPaths = new Set() }: Props) {
  const services = getServicesByView(viewId)
  if (services.length === 0) return null

  const implementedCount = services.filter(
    (s) => getWorkflowImplementationStatus(s, activeWebhookPaths) === 'implemented',
  ).length

  return (
    <section className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TitleWithHint
          as="h3"
          className="text-xs font-bold text-indigo-800 dark:text-indigo-200"
          hint={`이 화면과 연결된 자동화 플로우입니다. ▶ 실행 버튼으로 즉시 수동 트리거하거나, ${N8N_SCHEDULE_INTERVAL_HOURS}시간마다 자동으로 실행됩니다. 🔒 예정 플로우는 로드맵 단계입니다.`}
        >
          {title ?? `🔗 연결 플로우 (${services.length}개)`}
        </TitleWithHint>
        <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
          n8n 활성 {implementedCount} / {services.length} · ⏱ {N8N_SCHEDULE_INTERVAL_HOURS}h 자동
        </span>
      </div>

      <div className="space-y-1.5">
        {services.map((service) => (
          <FlowRow
            key={service.id}
            service={service}
            addToast={addToast}
            activeWebhookPaths={activeWebhookPaths}
          />
        ))}
      </div>
    </section>
  )
}
