'use client'

import type { AddToast } from '@/lib/dashboard-types'
import { getServicesByView } from '@/lib/n8n-research-roadmap'
import { N8nLv1ServicePanel } from '@/components/dashboard/n8n-lv1-service-panel'
import { TitleWithHint } from '@/components/dashboard/info-hint'

interface N8nLv1ServicesSectionProps {
  viewId: string
  addToast: AddToast
  title?: string
}

/** 연결 화면 상단에 Lv.1 n8n 시나리오 카드 노출 */
export function N8nLv1ServicesSection({ viewId, addToast, title }: N8nLv1ServicesSectionProps) {
  const services = getServicesByView(viewId)
  if (services.length === 0) return null

  return (
    <section className="space-y-3">
      <TitleWithHint
        as="h3"
        className="text-sm font-bold text-gray-800 dark:text-gray-200"
        hint="docs/guides/n8n-research.html Lv.1 로드맵과 연결된 자동화입니다. «워크플로 관리»에서 실행할 수 있습니다."
      >
        {title ?? '🔗 Lv.1 자동화 (n8n 시나리오)'}
      </TitleWithHint>
      {services.map((service) => (
        <N8nLv1ServicePanel
          key={service.id}
          service={service}
          addToast={addToast}
          compact
          defaultExpanded={service.status === 'next'}
        />
      ))}
    </section>
  )
}
