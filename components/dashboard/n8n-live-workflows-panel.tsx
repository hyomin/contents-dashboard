'use client'

import type { N8nLiveWorkflow } from '@/lib/n8n/live-workflows'
import { N8N_ARCHIVED_WORKFLOW_FILES } from '@/lib/n8n/live-workflows'
import { TitleWithHint } from '@/components/dashboard/info-hint'
import { webhookUrl } from '@/lib/n8n/urls'

const TRIGGER_LABELS: Record<string, string> = {
  webhook: 'Webhook',
  manual: '수동 실행',
  schedule: '스케줄',
}

interface N8nLiveWorkflowsPanelProps {
  workflows: N8nLiveWorkflow[]
  registeredPaths: ReadonlySet<string>
}

export function N8nLiveWorkflowsPanel({ workflows, registeredPaths }: N8nLiveWorkflowsPanelProps) {
  return (
    <section className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/25 p-5 space-y-4">
      <TitleWithHint
        as="h2"
        className="text-sm font-bold text-emerald-900 dark:text-emerald-200"
        hint="Docker n8n에 실제 Import·활성화된 워크플로입니다. 로드맵 카드와 별도로 «현행» 상태를 표시합니다."
      >
        현재 n8n 연동 ({workflows.length}개)
      </TitleWithHint>

      <div className="space-y-3">
        {workflows.map((w) => {
          const isLive = registeredPaths.has(w.webhookPath)
          return (
            <article
              key={w.key}
              className="rounded-xl bg-white/80 dark:bg-gray-900/60 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    isLive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {isLive ? '● Webhook 활성' : '○ Webhook 미등록'}
                </span>
                <span className="text-[10px] font-mono text-gray-400">{w.workflowFile}</span>
              </div>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{w.name}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">{w.description}</p>
              <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                <li>
                  <span className="text-gray-500">트리거 · </span>
                  {w.triggers.map((t) => TRIGGER_LABELS[t] ?? t).join(' · ')}
                  {w.scheduleHint ? ` (${w.scheduleHint})` : ''}
                </li>
                <li>
                  <span className="text-gray-500">Webhook · </span>
                  <code className="font-mono">{webhookUrl(w.webhookPath)}</code>
                </li>
                <li>
                  <span className="text-gray-500">핵심 노드 · </span>
                  {w.coreNodes}
                </li>
                {w.dashboardApis.map((api) => (
                  <li key={api.path}>
                    <span className="text-gray-500">대시보드 · </span>
                    <code className="font-mono">
                      {api.method} {api.path}
                    </code>
                    <span className="text-gray-400"> — {api.label}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      {N8N_ARCHIVED_WORKFLOW_FILES.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p className="font-semibold text-gray-700 dark:text-gray-300">다음 연동 후보 (레포 JSON만 있음)</p>
          <ul className="list-disc list-inside space-y-0.5">
            {N8N_ARCHIVED_WORKFLOW_FILES.map((a) => (
              <li key={a.workflowFile}>
                <span className="font-medium">{a.name}</span>
                <code className="mx-1 text-[10px]">/webhook/{a.webhookPath}</code>
                <span className="text-gray-500">— {a.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
