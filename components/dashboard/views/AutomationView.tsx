'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  N8N_AUTOMATION_ROADMAP,
  STAGE_META,
  getWorkflowImplementationStatus,
  isWorkflowRunnable,
  type N8nAutomationService,
  type AutomationStage,
} from '@/lib/n8n/research-roadmap'
import { N8N_LIVE_WORKFLOWS, N8N_SCHEDULE_INTERVAL_HOURS, type N8nLiveWorkflow } from '@/lib/n8n/live-workflows'
import { LOCAL_URLS } from '@/lib/n8n/urls'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface N8nStatusPayload {
  n8nHealthy: boolean
  activeWebhookCount: number
  expectedLiveWebhookCount?: number
  summary: string
  activeWebhookPaths: string[]
  urls?: typeof LOCAL_URLS
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  done:  { label: '✓ 운영 중', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  next:  { label: '▶ 다음 스텝', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  soon:  { label: '◷ 예정', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  later: { label: '… 장기 계획', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

/** 운영 워크플로 (W01~W07) 수동 실행 */
function useLiveRun(addToast: AddToast) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const run = useCallback(async (wf: N8nLiveWorkflow) => {
    setLoading((p) => ({ ...p, [wf.key]: true }))
    try {
      const webhookUrl = wf.dashboardApis.find((a) => a.method === 'POST')?.path
      if (!webhookUrl) {
        addToast(`${wf.no} ${wf.name}: 실행 API 없음`, 'warning')
        return
      }
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual' }),
      })
      const data = await res.json().catch(() => ({}))
      addToast(
        data.message ?? `${wf.no} ${wf.name} 실행 ${res.ok ? '완료' : '실패'}`,
        res.ok ? 'success' : 'warning',
      )
    } catch (e) {
      addToast(`${wf.no} 실행 오류: ${String(e).slice(0, 60)}`, 'warning')
    } finally {
      setLoading((p) => ({ ...p, [wf.key]: false }))
    }
  }, [addToast])

  return { loading, run }
}

/** 로드맵 서비스 수동 실행 */
function useServiceRun(addToast: AddToast) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const run = useCallback(async (service: N8nAutomationService, activeWebhookPaths: ReadonlySet<string>) => {
    if (!isWorkflowRunnable(service, activeWebhookPaths)) {
      addToast(`F${String(service.researchNo).padStart(2,'0')} ${service.n8nScenarioName}: 미구현 (로드맵 예정)`, 'info')
      return
    }
    setLoading((p) => ({ ...p, [service.id]: true }))
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
          body: JSON.stringify(service.samplePayload ?? {}),
        })
      }
      const data = await res.json().catch(() => ({}))
      addToast(
        data.message ?? `F${String(service.researchNo).padStart(2,'0')} ${service.n8nScenarioName} ${res.ok ? '완료' : '실패'}`,
        res.ok ? 'success' : 'warning',
      )
    } catch (e) {
      addToast(`실행 오류: ${String(e).slice(0, 60)}`, 'warning')
    } finally {
      setLoading((p) => ({ ...p, [service.id]: false }))
    }
  }, [addToast])

  return { loading, run }
}

export default function AutomationView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [n8nStatus, setN8nStatus] = useState<N8nStatusPayload | null>(null)
  const [stageFilter, setStageFilter] = useState<AutomationStage | 'all'>('all')
  const [viewMode, setViewMode] = useState<'live' | 'roadmap'>('live')
  const { loading: liveLoading, run: runLive } = useLiveRun(addToast)
  const { loading: svcLoading, run: runService } = useServiceRun(addToast)

  useEffect(() => {
    fetch('/api/dashboard/n8n-status')
      .then((r) => r.json())
      .then(setN8nStatus)
      .catch(() => setN8nStatus(null))
  }, [])

  const activeWebhookPaths = new Set(n8nStatus?.activeWebhookPaths ?? [])
  const urls = n8nStatus?.urls ?? LOCAL_URLS

  const roadmapFiltered = stageFilter === 'all'
    ? N8N_AUTOMATION_ROADMAP
    : N8N_AUTOMATION_ROADMAP.filter((s) => s.stage === stageFilter)

  const goToView = (viewId: string) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', viewId)
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── 헤더 ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 p-5 space-y-3">
        <TitleWithHint
          as="h2"
          className="text-base font-bold text-indigo-900 dark:text-indigo-200"
          hint="운영 중인 워크플로(W01~W07)와 전체 로드맵 플로우(F01~)를 번호로 식별합니다. 수동 실행 버튼으로 즉시 트리거, 12시간 주기로 자동 실행됩니다."
        >
          🔄 워크플로 관리
        </TitleWithHint>

        {/* 12시간 자동 실행 정보 */}
        <div className="rounded-xl bg-white/70 dark:bg-gray-900/50 border border-indigo-100 dark:border-indigo-900 px-4 py-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">
                ⏱ 자동 실행: {N8N_SCHEDULE_INTERVAL_HOURS}시간마다
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                n8n 스케줄 트리거 (hoursInterval: {N8N_SCHEDULE_INTERVAL_HOURS}) · cron: 0 */{N8N_SCHEDULE_INTERVAL_HOURS} * * *
              </p>
            </div>
            <a
              href="/api/cron/auto-collect"
              target="_blank"
              className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 transition"
            >
              cron 정보 보기 →
            </a>
          </div>
        </div>

        {/* n8n 상태 */}
        {n8nStatus && (
          <div className={`rounded-xl px-3 py-2 text-xs ${
            n8nStatus.n8nHealthy && n8nStatus.activeWebhookCount >= (n8nStatus.expectedLiveWebhookCount ?? 1)
              ? 'bg-emerald-100/80 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-amber-100/80 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
          }`}>
            <p className="font-semibold">{n8nStatus.summary}</p>
            <p className="text-[10px] mt-0.5 opacity-75">
              n8n: <a href={urls.n8nDirect} target="_blank" className="underline">{urls.n8nDirect}</a>
            </p>
          </div>
        )}
      </div>

      {/* ── 뷰 전환 탭 ────────────────────────────────────────── */}
      <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {(['live', 'roadmap'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewMode(v)}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition ${
              viewMode === v
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {v === 'live'
              ? `🟢 운영 중 워크플로 (W01~W${String(N8N_LIVE_WORKFLOWS.length).padStart(2, '0')})`
              : `📋 전체 로드맵 플로우 (${N8N_AUTOMATION_ROADMAP.length}개)`}
          </button>
        ))}
      </div>

      {/* ── 운영 중 워크플로 (W01~W07) ───────────────────────── */}
      {viewMode === 'live' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            n8n Docker에 배포된 워크플로입니다. 각 플로우는 {N8N_SCHEDULE_INTERVAL_HOURS}시간마다 자동 실행되고 수동으로도 즉시 트리거할 수 있습니다.
          </p>
          {N8N_LIVE_WORKFLOWS.map((wf) => {
            const isActive = activeWebhookPaths.has(wf.webhookPath)
            const isLoading = liveLoading[wf.key]
            const canRun = wf.dashboardApis.some((a) => a.method === 'POST')
            return (
              <div
                key={wf.key}
                className={`rounded-2xl border-2 p-4 ${
                  isActive
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* 번호 배지 */}
                    <span className="shrink-0 text-xs font-black px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white font-mono">
                      {wf.no}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {isActive ? '● Webhook 활성' : '○ Webhook 비활성'}
                        </span>
                        <span className="text-[10px] text-gray-400">⏱ {wf.scheduleHint}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{wf.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{wf.description}</p>
                    </div>
                  </div>

                  {/* 버튼 영역 */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {canRun && (
                      <button
                        type="button"
                        onClick={() => runLive(wf)}
                        disabled={isLoading}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition disabled:opacity-60 ${
                          isActive
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isLoading ? '⏳ 실행 중…' : `▶ ${wf.no} 수동 실행`}
                      </button>
                    )}
                    {wf.linkedViewIds.map((vid) => (
                      <button
                        key={vid}
                        type="button"
                        onClick={() => goToView(vid)}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                      >
                        {vid} 화면 →
                      </button>
                    ))}
                  </div>
                </div>

                {/* API 목록 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {wf.dashboardApis.map((api, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                      {api.method} {api.path}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 전체 로드맵 플로우 ─────────────────────────────────── */}
      {viewMode === 'roadmap' && (
        <div className="space-y-4">
          {/* 단계 필터 */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                stageFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              전체 ({N8N_AUTOMATION_ROADMAP.length})
            </button>
            {([1, 2, 3] as AutomationStage[]).map((stage) => {
              const count = N8N_AUTOMATION_ROADMAP.filter((s) => s.stage === stage).length
              const meta = STAGE_META[stage]
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stage)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    stageFilter === stage
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {meta.label} · {meta.subtitle} ({count})
                </button>
              )
            })}
          </div>

          {/* 플로우 리스트 */}
          {roadmapFiltered.map((service) => {
            const implStatus = getWorkflowImplementationStatus(service, activeWebhookPaths)
            const runnable = isWorkflowRunnable(service, activeWebhookPaths)
            const isLoading = svcLoading[service.id]
            const flowNo = `F${String(service.researchNo).padStart(2, '0')}`
            const stageMeta = STAGE_META[service.stage]
            const statusBadge = STATUS_BADGE[service.status] ?? STATUS_BADGE.later

            return (
              <div
                key={service.id}
                className={`rounded-2xl border p-4 transition ${
                  implStatus === 'implemented'
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : implStatus === 'partial'
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30 opacity-90'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* 번호 배지 */}
                    <div className="shrink-0 text-center">
                      <span className={`block text-xs font-black px-2 py-1 rounded-xl font-mono ${
                        implStatus === 'implemented'
                          ? 'bg-emerald-600 text-white'
                          : implStatus === 'partial'
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}>
                        {flowNo}
                      </span>
                      <span className="block text-[9px] text-gray-400 mt-0.5">{stageMeta.label}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                        {implStatus === 'implemented' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            ● n8n 활성
                          </span>
                        )}
                        {implStatus === 'partial' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                            ◐ 부분 구현
                          </span>
                        )}
                        {implStatus === 'unimplemented' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">
                            ○ 개발 예정
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">
                          {service.researchLevel.toUpperCase()}
                        </span>
                      </div>
                      <p className={`text-sm font-semibold ${
                        implStatus === 'unimplemented' ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'
                      }`}>
                        {service.n8nScenarioName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{service.description}</p>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => runService(service, activeWebhookPaths)}
                      disabled={isLoading || !runnable}
                      title={!runnable ? '개발 예정 플로우입니다' : `${flowNo} 수동 실행`}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                        !runnable
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : implStatus === 'implemented'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                      } disabled:opacity-60`}
                    >
                      {isLoading ? '⏳' : !runnable ? '🔒 개발 예정' : `▶ ${flowNo} 실행`}
                    </button>
                    <button
                      type="button"
                      onClick={() => goToView(service.linkedViewId)}
                      className="px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 transition"
                    >
                      {service.linkedViewId} →
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
