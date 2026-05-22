'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  ROADMAP_CATEGORY_TABS,
  filterRoadmapServicesForWorkflowUi,
  getServicesByCategory,
  getWorkflowImplementationMeta,
  getWorkflowImplementationStatus,
  isWorkflowRunnable,
  type RoadmapCategory,
  type N8nAutomationService,
} from '@/lib/n8n/research-roadmap'
import { N8N_LIVE_WORKFLOWS } from '@/lib/n8n/live-workflows'
import { N8nLiveWorkflowsPanel } from '@/components/dashboard/n8n-live-workflows-panel'
import { N8nLv1ServicePanel } from '@/components/dashboard/n8n-lv1-service-panel'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { LOCAL_URLS } from '@/lib/n8n/urls'

interface N8nStatusPayload {
  n8nHealthy: boolean
  activeWebhookCount: number
  expectedLiveWebhookCount?: number
  repoWorkflowCount: number
  summary: string
  activeWebhookPaths: string[]
  urls?: typeof LOCAL_URLS
  webhooks: {
    path: string
    label: string
    registered: boolean
    url?: string
    error?: string
  }[]
}

export default function AutomationView({ addToast }: { addToast: AddToast }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<RoadmapCategory>('trend')
  const [n8nStatus, setN8nStatus] = useState<N8nStatusPayload | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/n8n-status')
      .then((r) => r.json())
      .then(setN8nStatus)
      .catch(() => setN8nStatus(null))
  }, [])

  const activeWebhookPaths = useMemo(
    () => new Set(n8nStatus?.activeWebhookPaths ?? []),
    [n8nStatus?.activeWebhookPaths],
  )

  const services = filterRoadmapServicesForWorkflowUi(
    getServicesByCategory(tab),
    activeWebhookPaths,
  )
  const implementedRaw = services.filter(
    (s) => getWorkflowImplementationStatus(s, activeWebhookPaths) === 'implemented',
  )
  const seenWebhook = new Set<string>()
  const implemented = implementedRaw.filter((s) => {
    if (seenWebhook.has(s.webhookPath)) return false
    seenWebhook.add(s.webhookPath)
    return true
  })
  const partial = services.filter(
    (s) => getWorkflowImplementationStatus(s, activeWebhookPaths) === 'partial',
  )
  const unimplemented = services.filter(
    (s) => getWorkflowImplementationStatus(s, activeWebhookPaths) === 'unimplemented',
  )

  const urls = n8nStatus?.urls ?? LOCAL_URLS

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-5 space-y-3">
        <TitleWithHint
          as="h2"
          className="text-sm font-bold text-blue-900 dark:text-blue-200"
          hint="«구현됨»은 n8n Docker에서 Webhook이 실제로 등록된 경우만 표시합니다."
        >
          워크플로 실행 · 관리
        </TitleWithHint>

        <div className="rounded-xl bg-white/70 dark:bg-gray-900/50 border border-blue-100 dark:border-blue-900 px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
          <p className="font-semibold text-gray-900 dark:text-white">로컬 접속 경로</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            <li>
              대시보드:{' '}
              <a href={urls.dashboard} className="text-blue-600 hover:underline font-mono">
                {urls.dashboard}
              </a>
            </li>
            <li>
              n8n 편집기(직접):{' '}
              <a href={urls.n8nDirect} className="text-blue-600 hover:underline font-mono">
                {urls.n8nDirect}
              </a>
            </li>
            <li>
              n8n(대시보드 경유):{' '}
              <a href={urls.n8nViaDashboard} className="text-blue-600 hover:underline font-mono">
                {urls.n8nViaDashboard}
              </a>
              <span className="text-gray-500"> — 끝에 슬래시(/) 붙이면 안 됨</span>
            </li>
            <li>
              Webhook: <span className="font-mono">{urls.webhookBase}/&#123;path&#125;</span>
            </li>
          </ul>
        </div>

        {n8nStatus && (
          <div
            className={`rounded-xl px-3 py-2 text-xs ${
              n8nStatus.n8nHealthy &&
              n8nStatus.activeWebhookCount >= (n8nStatus.expectedLiveWebhookCount ?? 1)
                ? 'bg-emerald-100/80 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-amber-100/80 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
            }`}
          >
            <p className="font-semibold">{n8nStatus.summary}</p>
            <ul className="mt-1.5 space-y-1">
              {n8nStatus.webhooks.map((w) => (
                <li key={w.path} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>{w.registered ? '●' : '○'}</span>
                  <span className="font-medium">{w.label}</span>
                  <code className="text-[10px] opacity-80">{w.url ?? `${urls.webhookBase}/${w.path}`}</code>
                  {!w.registered && w.error && (
                    <span className="text-[10px] opacity-75">— {w.error.slice(0, 80)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const p = new URLSearchParams(searchParams.toString())
            p.set('view', 'n8n-lv1')
            router.push(`${pathname}?${p.toString()}`)
          }}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition"
        >
          자동화 로드맵 열기 →
        </button>
      </div>

      <N8nLiveWorkflowsPanel workflows={N8N_LIVE_WORKFLOWS} registeredPaths={activeWebhookPaths} />

      <div>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
          로드맵별 연동 상태
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          n8n에 아직 없는 항목은 «부분 구현»·«미구현»으로 표시됩니다. 우선순위는 아래 카테고리 탭에서
          확인하세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full">
        {ROADMAP_CATEGORY_TABS.map((t) => {
          const catServices = filterRoadmapServicesForWorkflowUi(
            getServicesByCategory(t.id),
            activeWebhookPaths,
          )
          const impl = catServices.filter(
            (s) => getWorkflowImplementationStatus(s, activeWebhookPaths) === 'implemented',
          ).length
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[120px] px-3 py-2.5 text-sm font-medium rounded-lg transition text-left sm:text-center ${
                tab === t.id
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="block">
                {t.icon} {t.label}
              </span>
              <span className="block text-[10px] font-normal opacity-70 mt-0.5">
                n8n 활성 {impl} / {catServices.length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs -mt-2">
        <span className="text-gray-500">
          {ROADMAP_CATEGORY_TABS.find((t) => t.id === tab)?.label} · n8n 구현 {implemented.length} · 부분{' '}
          {partial.length} · 미구현 {unimplemented.length}
        </span>
        {(['implemented', 'partial', 'unimplemented'] as const).map((key) => {
          const m = getWorkflowImplementationMeta(key)
          const dot =
            key === 'implemented'
              ? 'bg-emerald-500'
              : key === 'partial'
                ? 'bg-amber-500'
                : 'bg-gray-400'
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
              title={m.hint}
            >
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {m.label}
            </span>
          )
        })}
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">이 카테고리에 등록된 워크플로가 없습니다.</p>
      ) : (
        <WorkflowGroupedList
          implemented={implemented}
          partial={partial}
          unimplemented={unimplemented}
          activeWebhookPaths={activeWebhookPaths}
          addToast={addToast}
        />
      )}
    </div>
  )
}

function WorkflowGroupedList({
  implemented,
  partial,
  unimplemented,
  activeWebhookPaths,
  addToast,
}: {
  implemented: N8nAutomationService[]
  partial: N8nAutomationService[]
  unimplemented: N8nAutomationService[]
  activeWebhookPaths: ReadonlySet<string>
  addToast: AddToast
}) {
  return (
    <div className="space-y-8">
      {implemented.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            n8n 구현됨 (Webhook 활성)
            <span className="text-xs font-normal text-gray-500">({implemented.length}개)</span>
          </h3>
          <div className="space-y-4">
            {implemented.map((service) => (
              <N8nLv1ServicePanel
                key={service.id}
                service={service}
                addToast={addToast}
                activeWebhookPaths={activeWebhookPaths}
                defaultExpanded
              />
            ))}
          </div>
        </section>
      )}

      {partial.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            부분 구현 (대시보드 API·더미·n8n 비활성)
            <span className="text-xs font-normal text-gray-500">({partial.length}개)</span>
          </h3>
          <div className="space-y-4">
            {partial.map((service) => (
              <N8nLv1ServicePanel
                key={service.id}
                service={service}
                addToast={addToast}
                activeWebhookPaths={activeWebhookPaths}
                defaultExpanded={false}
              />
            ))}
          </div>
        </section>
      )}

      {unimplemented.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-400 border border-gray-300" />
            미구현 (로드맵)
            <span className="text-xs font-normal">({unimplemented.length}개)</span>
          </h3>
          <div className="space-y-4">
            {unimplemented.map((service) => (
              <N8nLv1ServicePanel
                key={service.id}
                service={service}
                addToast={addToast}
                activeWebhookPaths={activeWebhookPaths}
                defaultExpanded={false}
              />
            ))}
          </div>
        </section>
      )}

      {implemented.length === 0 && partial.length === 0 && unimplemented.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300 text-center py-4">
          n8n Webhook이 하나도 활성화되지 않았습니다. 터미널에서{' '}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">./scripts/n8n-setup.sh</code> 를
          실행하세요.
        </p>
      )}
    </div>
  )
}
