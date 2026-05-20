/**
 * Docker n8n에 실제 배포·활성화된 워크플로 (대시보드 «워크플로 관리» 기준).
 * n8n UI와 다르면 이 파일 + scripts/n8n-setup.sh 를 맞춥니다.
 */

export type N8nTriggerKind = 'webhook' | 'manual' | 'schedule'

export interface N8nLiveWorkflow {
  key: string
  name: string
  webhookPath: string
  envWebhookKey: string
  workflowFile: string
  triggers: N8nTriggerKind[]
  scheduleHint?: string
  description: string
  coreNodes: string
  /** 로드맵 카드 id — 동일 Webhook으로 커버되는 항목 */
  roadmapServiceIds: string[]
  linkedViewIds: string[]
  dashboardApis: { method: 'GET' | 'POST'; path: string; label: string }[]
}

/** 현재 n8n에 1개만 활성 */
export const N8N_LIVE_WORKFLOWS: N8nLiveWorkflow[] = [
  {
    key: 'youtube-collect',
    name: 'YouTube 채널 데이터 수집',
    webhookPath: 'youtube-collect',
    envWebhookKey: 'N8N_WEBHOOK_YOUTUBE_COLLECT',
    workflowFile: 'N8N_YOUTUBE_COLLECT.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '6시간마다 자동 수집',
    description:
      'Supabase 채널 목록 → YouTube API 통계·영상 → Supabase 저장. Webhook·수동·스케줄 트리거.',
    coreNodes: 'Webhook · Schedule · YouTube API · HTTP · Supabase',
    roadmapServiceIds: ['channel-vs-avg', 'multi-channel-collect'],
    linkedViewIds: ['data-collect', 'my-youtube'],
    dashboardApis: [
      { method: 'POST', path: '/api/dashboard/collect-all', label: '전체 채널 수집 (대시보드 API)' },
    ],
  },
  {
    key: 'outlier-tagging',
    name: '아웃라이어 자동 태깅',
    webhookPath: 'outlier-tagging',
    envWebhookKey: 'N8N_WEBHOOK_OUTLIER_TAG',
    workflowFile: 'N8N_OUTLIER_TAGGING.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 자동 태깅',
    description:
      'Supabase videos에서 vs.Avg 기준 이상 영상을 outlier_tags 테이블에 저장. Tier 상향은 대시보드 API에서 처리.',
    coreNodes: 'Webhook · IF · Supabase HTTP',
    roadmapServiceIds: ['outlier-tagging'],
    linkedViewIds: ['outlier'],
    dashboardApis: [
      { method: 'GET', path: '/api/dashboard/videos?type=outliers&limit=50', label: 'Outlier 후보 조회' },
      { method: 'POST', path: '/api/dashboard/outlier-tag', label: '태깅 실행 (Tier 포함)' },
    ],
  },
]

export interface N8nArchivedWorkflow {
  workflowFile: string
  name: string
  webhookPath: string
  reason: string
}

/** 레포 JSON만 있고 n8n 미배포·삭제됨 */
export const N8N_ARCHIVED_WORKFLOW_FILES: N8nArchivedWorkflow[] = [
  {
    workflowFile: 'N8N_TOPIC_SUGGEST.json',
    name: '주제 선별 AI',
    webhookPath: 'topic-suggest',
    reason: 'LangChain(Claude) 노드 패키지 필요 — 재임포트 전까지 비활성',
  },
]

export function getLiveWorkflowByPath(path: string): N8nLiveWorkflow | undefined {
  return N8N_LIVE_WORKFLOWS.find((w) => w.webhookPath === path)
}

export function getLiveWebhookPaths(): string[] {
  return N8N_LIVE_WORKFLOWS.map((w) => w.webhookPath)
}
