import type { N8nAutomationService } from '@/lib/n8n/research-roadmap'

/** UI·상태 API용 — «구현됨»이 무엇을 의미하는지 구분 */
export type WorkflowDeployKind = 'dashboard-api' | 'n8n-json' | 'n8n-hybrid' | 'dummy' | 'planned'

export interface WorkflowDeployMeta {
  kind: WorkflowDeployKind
  label: string
  shortLabel: string
  hint: string
}

const DEPLOY_META: Record<WorkflowDeployKind, Omit<WorkflowDeployMeta, 'kind'>> = {
  'dashboard-api': {
    label: '대시보드 API',
    shortLabel: 'API',
    hint: 'n8n 없이 대시보드 API로 동작합니다. 레포 JSON은 n8n 스케줄·웹훅용입니다.',
  },
  'n8n-json': {
    label: 'n8n JSON',
    shortLabel: 'n8n',
    hint: 'docs/n8n/workflows JSON이 있습니다. Docker n8n에 Import·활성화하면 Webhook으로 실행됩니다.',
  },
  'n8n-hybrid': {
    label: 'API + n8n',
    shortLabel: '혼합',
    hint: '대시보드 API와 n8n Webhook(.env)을 함께 씁니다. Webhook 미설정 시 더미 응답입니다.',
  },
  dummy: {
    label: '미리보기',
    shortLabel: '더미',
    hint: 'UI·더미 응답만 가능합니다. n8n Webhook 연동 후 실제 실행으로 전환됩니다.',
  },
  planned: {
    label: '로드맵',
    shortLabel: '예정',
    hint: '아직 설계·연동 전입니다.',
  },
}

export function getWorkflowDeployKind(service: N8nAutomationService): WorkflowDeployKind {
  if (service.integrationMode === 'roadmap') return 'planned'
  if (service.integrationMode === 'dummy') return 'dummy'
  if (service.integrationMode === 'hybrid') return 'n8n-hybrid'
  if (service.integrationMode === 'api' && service.api) return 'dashboard-api'
  if (service.n8nWorkflowFile) return 'n8n-json'
  return 'planned'
}

export function getWorkflowDeployMeta(service: N8nAutomationService): WorkflowDeployMeta {
  const kind = getWorkflowDeployKind(service)
  return { kind, ...DEPLOY_META[kind] }
}

import { N8N_ARCHIVED_WORKFLOW_FILES, N8N_LIVE_WORKFLOWS } from '@/lib/n8n/live-workflows'

/** n8n에 배포·활성 대상 JSON (setup 스크립트가 임포트) */
export const REPO_N8N_WORKFLOW_FILES = N8N_LIVE_WORKFLOWS.map((w) => w.workflowFile) as readonly string[]

/** 레포에만 있고 현재 n8n 미배포 */
export { N8N_ARCHIVED_WORKFLOW_FILES }
