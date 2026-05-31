/**
 * Docker n8n에 실제 배포·활성화된 워크플로 (대시보드 «워크플로 관리» 기준).
 * n8n UI와 다르면 이 파일 + scripts/n8n-setup.sh 를 맞춥니다.
 */

export type N8nTriggerKind = 'webhook' | 'manual' | 'schedule'

/** 자동 수행 주기: 12시간마다 (n8n: hoursInterval) */
export const N8N_SCHEDULE_INTERVAL_HOURS = 12
/** @deprecated 하위호환 — N8N_SCHEDULE_INTERVAL_HOURS 사용 권장 */
export const N8N_SCHEDULE_INTERVAL_DAYS = 1

export interface N8nLiveWorkflow {
  /** 운영 워크플로 표시 번호 (W01~W07) */
  no: string
  key: string
  name: string
  webhookPath: string
  envWebhookKey: string
  workflowFile: string
  triggers: N8nTriggerKind[]
  scheduleHint?: string
  description: string
  coreNodes: string
  roadmapServiceIds: string[]
  linkedViewIds: string[]
  dashboardApis: { method: 'GET' | 'POST'; path: string; label: string }[]
}

export const N8N_LIVE_WORKFLOWS: N8nLiveWorkflow[] = [
  {
    no: 'W01',
    key: 'youtube-collect',
    name: 'YouTube 채널 데이터 수집',
    webhookPath: 'youtube-collect',
    envWebhookKey: 'N8N_WEBHOOK_YOUTUBE_COLLECT',
    workflowFile: 'N8N_YOUTUBE_COLLECT.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 자동 수집',
    description:
      'Supabase 채널 목록 → YouTube API 통계·영상 → Supabase 저장. Webhook·수동·1일 스케줄.',
    coreNodes: 'Webhook · Schedule · YouTube API · HTTP · Supabase',
    roadmapServiceIds: ['channel-vs-avg', 'multi-channel-collect'],
    linkedViewIds: ['data-collect', 'my-youtube'],
    dashboardApis: [
      { method: 'POST', path: '/api/dashboard/collect-all', label: '전체 채널 수집 (대시보드 API)' },
    ],
  },
  {
    no: 'W02',
    key: 'outlier-tagging',
    name: '아웃라이어 자동 태깅',
    webhookPath: 'outlier-tagging',
    envWebhookKey: 'N8N_WEBHOOK_OUTLIER_TAG',
    workflowFile: 'N8N_OUTLIER_TAGGING.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 자동 태깅',
    description:
      'Supabase videos에서 vs.Avg 기준 이상 영상을 outlier_tags 테이블에 저장.',
    coreNodes: 'Webhook · Schedule · IF · Supabase HTTP',
    roadmapServiceIds: ['outlier-tagging'],
    linkedViewIds: ['outlier'],
    dashboardApis: [
      { method: 'GET', path: '/api/dashboard/videos?type=outliers&limit=50', label: 'Outlier 후보 조회' },
      { method: 'POST', path: '/api/dashboard/outlier-tag', label: '태깅 실행 (Tier 포함)' },
    ],
  },
  {
    no: 'W03',
    key: 'rss-topic-collect',
    name: 'RSS → 주제 후보 자동 수집',
    webhookPath: 'rss-topic-collect',
    envWebhookKey: 'N8N_WEBHOOK_RSS_TOPICS',
    workflowFile: 'N8N_RSS_TOPIC_COLLECT.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 자동 수집',
    description:
      '경제·사회 RSS에서 시니어 관련 기사를 골라 rss_topic_candidates에 저장.',
    coreNodes: 'Webhook · Schedule · RSS · Code · Supabase',
    roadmapServiceIds: ['rss-topic-collect'],
    linkedViewIds: ['content-guide'],
    dashboardApis: [
      { method: 'GET', path: '/api/dashboard/rss-topics', label: '저장된 주제 목록' },
      { method: 'POST', path: '/api/dashboard/rss-topics', label: 'RSS 주제 수집 실행' },
    ],
  },
  {
    no: 'W04',
    key: 'naver-blog-collect',
    name: '네이버 블로그 글 목록 수집 (검색 Open API)',
    webhookPath: 'naver-blog-collect',
    envWebhookKey: 'N8N_WEBHOOK_NAVER_BLOG_COLLECT',
    workflowFile: 'N8N_NAVER_BLOG_COLLECT.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 · 글 수집 후 조회수 갱신',
    description:
      'n8n → 대시보드 collect-platform(naver-blog) → naver-blog-views. Webhook·수동·1일 스케줄.',
    coreNodes: 'Webhook · Schedule · HTTP · 대시보드 API ×2',
    roadmapServiceIds: ['naver-blog-collect'],
    linkedViewIds: ['naver-blog', 'data-collect'],
    dashboardApis: [
      { method: 'POST', path: '/api/dashboard/collect-platform', label: '네이버 글 목록 수집' },
      { method: 'POST', path: '/api/dashboard/naver-blog-views', label: '조회수·vs.Avg 갱신' },
    ],
  },
  {
    no: 'W05',
    key: 'tistory-collect',
    name: '티스토리 글 목록 수집 (RSS)',
    webhookPath: 'tistory-collect',
    envWebhookKey: 'N8N_WEBHOOK_TISTORY_COLLECT',
    workflowFile: 'N8N_TISTORY_COLLECT.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 · RSS 글 목록 갱신',
    description:
      'n8n → 대시보드 collect-platform(tistory) → Supabase videos 저장. Webhook·수동·1일 스케줄.',
    coreNodes: 'Webhook · Schedule · HTTP · 대시보드 API',
    roadmapServiceIds: ['tistory-collect'],
    linkedViewIds: ['tistory', 'data-collect'],
    dashboardApis: [
      { method: 'POST', path: '/api/dashboard/collect-platform', label: '티스토리 RSS 글 목록 수집' },
    ],
  },
  {
    no: 'W06',
    key: 'notion-log',
    name: 'Notion 자동화 로그 기록',
    webhookPath: 'notion-log',
    envWebhookKey: 'N8N_WEBHOOK_NOTION_LOG',
    workflowFile: '',
    triggers: ['schedule'],
    scheduleHint: '각 워크플로 완료 후 자동 호출 (별도 워크플로 불필요)',
    description:
      '모든 수집·태깅 워크플로 완료 시 Notion에 날짜/플랫폼/콘텐츠 링크를 자동 기록합니다.',
    coreNodes: 'HTTP · 대시보드 notion-sync API · Notion API',
    roadmapServiceIds: [],
    linkedViewIds: ['data-collect'],
    dashboardApis: [
      { method: 'POST', path: '/api/dashboard/notion-sync', label: 'Notion 기록' },
      { method: 'GET', path: '/api/dashboard/notion-sync', label: 'Notion 설정 확인' },
    ],
  },
  {
    no: 'W07',
    key: 'naver-blog-views',
    name: '네이버 블로그 조회수·vs.Avg 갱신',
    webhookPath: 'naver-blog-views',
    envWebhookKey: 'N8N_WEBHOOK_NAVER_BLOG_VIEWS',
    workflowFile: 'N8N_NAVER_BLOG_VIEWS.json',
    triggers: ['webhook', 'manual', 'schedule'],
    scheduleHint: '12시간마다 (글 목록 수집 후 권장)',
    description:
      'Supabase naver-blog 글에 조회수·좋아요·댓글을 수집해 vs.Avg를 갱신합니다.',
    coreNodes: 'Webhook · Schedule · HTTP · 대시보드 API',
    roadmapServiceIds: ['naver-blog-views'],
    linkedViewIds: ['naver-blog', 'data-collect'],
    dashboardApis: [
      { method: 'GET', path: '/api/dashboard/naver-blog-views', label: '설명·기본값' },
      { method: 'POST', path: '/api/dashboard/naver-blog-views', label: '메트릭·vs.Avg 갱신' },
    ],
  },
  {
    no: 'W08',
    key: 'longform-script',
    name: '콘텐츠 가이드 AI 생성 (글·이미지·영상)',
    webhookPath: 'longform-script',
    envWebhookKey: 'N8N_WEBHOOK_LONGFORM_SCRIPT',
    workflowFile: 'N8N_LONGFORM_SCRIPT.json',
    triggers: ['webhook', 'manual'],
    scheduleHint: '수동 실행 (콘텐츠 가이드에서 생성 시)',
    description:
      '발행 주제(필수) + (선택) 레퍼런스 → Gemini 초안. writing/blog·image/carousel·video/longform. script-guide가 n8n 1순위·content-generate 폴백.',
    coreNodes: 'Webhook · Code · Gemini API',
    roadmapServiceIds: ['longform-script'],
    linkedViewIds: ['content-guide', 'generation-history', 'content-studio'],
    dashboardApis: [
      { method: 'POST', path: '/api/dashboard/script-guide', label: '스크립트 가이드 생성 (n8n 1순위)' },
      { method: 'POST', path: '/api/dashboard/content-polish', label: '내 콘텐츠화 (대시보드 전용)' },
      { method: 'GET', path: '/api/dashboard/generation-history', label: '생성 히스토리' },
    ],
  },
  {
    no: 'W09',
    key: 'topic-suggest',
    name: '주제 선별 AI (Gemini + RSS/Outlier)',
    webhookPath: 'topic-suggest',
    envWebhookKey: 'N8N_WEBHOOK_TOPIC_SUGGEST',
    workflowFile: 'N8N_TOPIC_SUGGEST_V2.json',
    triggers: ['webhook', 'manual'],
    scheduleHint: '수동 실행 (기획 회의 전)',
    description:
      'RSS 트렌드 + 아웃라이어 데이터 → Gemini가 이번 주 추천 주제 5개 + 제목·이유 생성.',
    coreNodes: 'Webhook · HTTP · Gemini API · 대시보드 API · Notion',
    roadmapServiceIds: ['topic-recommend-agent', 'rss-topic-collect'],
    linkedViewIds: ['topic-suggest', 'content-guide'],
    dashboardApis: [
      { method: 'GET', path: '/api/dashboard/rss-topics?limit=10', label: 'RSS 주제 후보 조회' },
      { method: 'GET', path: '/api/dashboard/videos?type=outliers&limit=10', label: 'Outlier 영상 조회' },
    ],
  },
]

export interface N8nArchivedWorkflow {
  workflowFile: string
  name: string
  webhookPath: string
  reason: string
}

export const N8N_ARCHIVED_WORKFLOW_FILES: N8nArchivedWorkflow[] = [
  {
    workflowFile: 'N8N_TOPIC_SUGGEST.json',
    name: '주제 선별 AI (구버전 — LangChain)',
    webhookPath: 'topic-suggest-v1-archived',
    reason: 'LangChain(Claude) 노드 필요 — V2(N8N_TOPIC_SUGGEST_V2.json, Gemini HTTP)로 대체됨',
  },
]

export function getLiveWorkflowByPath(path: string): N8nLiveWorkflow | undefined {
  return N8N_LIVE_WORKFLOWS.find((w) => w.webhookPath === path)
}

export function getLiveWebhookPaths(): string[] {
  return N8N_LIVE_WORKFLOWS.map((w) => w.webhookPath)
}
