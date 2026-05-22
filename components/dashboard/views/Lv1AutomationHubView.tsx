'use client'

import { useState, useEffect } from 'react'
import type { AddToast } from '@/lib/dashboard/dashboard-types'
import {
  STAGE_META,
  filterRoadmapServicesForWorkflowUi,
  getServicesByStage,
  type AutomationStage,
  type N8nAutomationService,
  type RoadmapStatus,
} from '@/lib/n8n/research-roadmap'
import { N8N_LIVE_WORKFLOWS } from '@/lib/n8n/live-workflows'
import { N8nLiveWorkflowsPanel } from '@/components/dashboard/n8n-live-workflows-panel'
import { N8nLv1ServicePanel } from '@/components/dashboard/n8n-lv1-service-panel'
import { TitleWithHint } from '@/components/dashboard/info-hint'

const STAGES: AutomationStage[] = [1, 2, 3]

/** 1단계: 완료 / 다음 스텝 / (soon) · 2·3단계: 카테고리별 */
const STAGE1_GROUPS: { key: RoadmapStatus | 'all-soon'; label: string; filter: (s: N8nAutomationService) => boolean }[] = [
  { key: 'next', label: '🟢 다음 스텝', filter: (s) => s.status === 'next' },
  { key: 'done', label: '✅ 구현 완료', filter: (s) => s.status === 'done' },
  { key: 'all-soon', label: '🟡 로드맵 (3개월 후)', filter: (s) => s.status === 'soon' },
]

const CATEGORY_ORDER = ['trend', 'content', 'deploy', 'ops'] as const
const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  trend: '📊 트렌드 분석 & 데이터 수집',
  content: '✍️ 콘텐츠 기획 & 스크립트',
  deploy: '📡 배포 & 발행',
  ops: '⚙️ 운영 & 수익',
}

function StageServiceList({
  services,
  addToast,
  defaultExpanded,
  activeWebhookPaths,
}: {
  services: N8nAutomationService[]
  addToast: AddToast
  defaultExpanded: boolean
  activeWebhookPaths: ReadonlySet<string>
}) {
  if (services.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">이 단계에 등록된 항목이 없습니다.</p>
  }
  return (
    <div className="space-y-4">
      {services.map((service) => (
        <N8nLv1ServicePanel
          key={service.id}
          service={service}
          addToast={addToast}
          activeWebhookPaths={activeWebhookPaths}
          defaultExpanded={defaultExpanded && activeWebhookPaths.has(service.webhookPath)}
        />
      ))}
    </div>
  )
}

export default function Lv1AutomationHubView({ addToast }: { addToast: AddToast }) {
  const [stage, setStage] = useState<AutomationStage>(1)
  const [activeWebhookPaths, setActiveWebhookPaths] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    fetch('/api/dashboard/n8n-status')
      .then((r) => r.json())
      .then((d: { activeWebhookPaths?: string[] }) =>
        setActiveWebhookPaths(new Set(d.activeWebhookPaths ?? [])),
      )
      .catch(() => setActiveWebhookPaths(new Set()))
  }, [])

  const meta = STAGE_META[stage]
  const stageServices = filterRoadmapServicesForWorkflowUi(
    getServicesByStage(stage),
    activeWebhookPaths,
  )
  const n8nLiveCount = N8N_LIVE_WORKFLOWS.filter((w) => activeWebhookPaths.has(w.webhookPath)).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30 p-5">
        <TitleWithHint
          as="h2"
          className="text-sm font-bold text-violet-900 dark:text-violet-200"
          hint="docs/guides/n8n-research.html 기준 1·2·3단계 로드맵입니다. 각 카드 «n8n 시나리오 정보»에서 자동화 이름을 확인하고 n8n에 동일 이름으로 워크플로를 준비하세요."
        >
          n8n 자동화 로드맵
        </TitleWithHint>
        <p className="text-xs text-violet-800/80 dark:text-violet-300/80 mt-2">
          상단 탭으로 단계를 바꿉니다. 현재 n8n에 연동된 워크플로는 <strong>{n8nLiveCount}개</strong>
          (전체 로드맵과 별도 표시).
        </p>
      </div>

      <N8nLiveWorkflowsPanel workflows={N8N_LIVE_WORKFLOWS} registeredPaths={activeWebhookPaths} />

      {/* 단계 탭 */}
      <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-fit">
        {STAGES.map((s) => {
          const count = getServicesByStage(s).length
          const sm = STAGE_META[s]
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium rounded-lg transition text-left sm:text-center min-w-[100px] ${
                stage === s
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="block font-bold">{sm.label}</span>
              <span className="block text-[10px] font-normal opacity-70 mt-0.5">
                {sm.subtitle} · {count}개
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 -mt-2">{meta.hint}</p>

      {stage === 1 ? (
        <div className="space-y-8">
          {STAGE1_GROUPS.map((group) => {
            const items = stageServices.filter(group.filter)
            if (items.length === 0) return null
            return (
              <section key={group.key}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span>{group.label}</span>
                  <span className="text-xs font-normal text-gray-500">({items.length}개)</span>
                </h3>
                <StageServiceList
                  services={items}
                  addToast={addToast}
                  activeWebhookPaths={activeWebhookPaths}
                  defaultExpanded={group.key === 'next'}
                />
              </section>
            )
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((cat) => {
            const items = stageServices.filter((s) => s.category === cat)
            if (items.length === 0) return null
            return (
              <section key={cat}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span className="text-xs font-normal text-gray-500">({items.length}개)</span>
                </h3>
                <StageServiceList
                  services={items}
                  addToast={addToast}
                  activeWebhookPaths={activeWebhookPaths}
                  defaultExpanded={false}
                />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
