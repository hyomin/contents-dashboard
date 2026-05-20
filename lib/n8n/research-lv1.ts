/**
 * @deprecated 호환용 — 신규 코드는 `n8n-research-roadmap` 사용
 */
export type {
  N8nAutomationService as N8nLv1Service,
  RoadmapStatus as N8nLv1ServiceStatus,
  RoadmapCategory as N8nLv1Category,
  RoadmapIntegrationMode as N8nLv1IntegrationMode,
} from '@/lib/n8n/research-roadmap'

export {
  N8N_AUTOMATION_ROADMAP as N8N_LV1_SERVICES,
  getAutomationService as getN8nLv1Service,
  getServicesByView as getN8nLv1ServicesByView,
  getCategoryLabel as getN8nLv1CategoryLabel,
} from '@/lib/n8n/research-roadmap'

import { getServicesByStage } from '@/lib/n8n/research-roadmap'

export function getN8nLv1NextStepServices() {
  return getServicesByStage(1).filter((s) => s.status === 'next')
}
