/**
 * docs/guides/n8n-research.html 전체 자동화 로드맵.
 * 1단계 = Lv.1 · 2단계 = Lv.2 · 3단계 = Lv.3 + Agent
 */

export type AutomationStage = 1 | 2 | 3
export type ResearchLevel = 'lv1' | 'lv2' | 'lv3' | 'agent'
export type RoadmapStatus = 'done' | 'next' | 'soon' | 'later'
export type RoadmapCategory = 'trend' | 'content' | 'deploy' | 'ops'
export type RoadmapIntegrationMode = 'api' | 'n8n' | 'dummy' | 'hybrid' | 'roadmap'

export interface N8nAutomationService {
  id: string
  researchNo: number
  stage: AutomationStage
  researchLevel: ResearchLevel
  n8nScenarioName: string
  description: string
  category: RoadmapCategory
  status: RoadmapStatus
  coreNodes: string
  expectedEffect: string
  webhookPath: string
  envWebhookKey?: string
  n8nWorkflowFile?: string | null
  /** 활성 Webhook이 있을 때 UI에서 숨김 (동일 n8n 워크플로로 커버) */
  coveredByWebhookPath?: string
  linkedViewId: string
  integrationMode: RoadmapIntegrationMode
  api?: {
    method: 'GET' | 'POST'
    path: string
    label: string
  }
  samplePayload?: Record<string, unknown>
}

export const STAGE_META: Record<
  AutomationStage,
  { label: string; subtitle: string; hint: string }
> = {
  1: {
    label: '1단계',
    subtitle: 'Lv.1 · n8n 기초',
    hint: '지금 바로 확장 가능한 자동화. 완료·다음 스텝 항목부터 n8n 시나리오를 연결하세요.',
  },
  2: {
    label: '2단계',
    subtitle: 'Lv.2 · API·조건 분기',
    hint: '약 3개월 후 도입 예정. Apify·Schedule·멀티 API 연동이 필요한 중급 워크플로입니다.',
  },
  3: {
    label: '3단계',
    subtitle: 'Lv.3 · Agent · 복합 파이프라인',
    hint: '약 6개월 후 도입 예정. AI Agent 체인·멀티 플랫폼 발행 등 고급 자동화입니다.',
  },
}

export const N8N_AUTOMATION_ROADMAP: N8nAutomationService[] = [
  // ── 1단계 (Lv.1) ──
  {
    id: 'channel-vs-avg',
    researchNo: 1,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '채널 콘텐츠 리스트 + vs avg',
    description: '채널 등록 → 최근 영상 목록 호출 → 평균 조회수 대비 성과 계산',
    category: 'trend',
    status: 'done',
    coreNodes: 'YouTube API · HTTP · Supabase',
    expectedEffect: '경쟁 채널 성과 파악',
    webhookPath: 'youtube-collect',
    n8nWorkflowFile: 'N8N_YOUTUBE_COLLECT.json',
    envWebhookKey: 'N8N_WEBHOOK_YOUTUBE_COLLECT',
    linkedViewId: 'data-collect',
    integrationMode: 'api',
    api: { method: 'POST', path: '/api/dashboard/collect-all', label: '전체 채널 수집' },
  },
  {
    id: 'outlier-tagging',
    researchNo: 2,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '아웃라이어 자동 태깅',
    description: 'vs avg 3배 이상 영상 → outlier_tags 저장 · Tier 상향 (대시보드 API)',
    category: 'trend',
    status: 'done',
    coreNodes: 'Webhook · IF · Supabase',
    expectedEffect: '히트 영상 패턴 추출 재료',
    webhookPath: 'outlier-tagging',
    envWebhookKey: 'N8N_WEBHOOK_OUTLIER_TAG',
    n8nWorkflowFile: 'N8N_OUTLIER_TAGGING.json',
    linkedViewId: 'outlier',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/dashboard/outlier-tag', label: '아웃라이어 태깅 실행' },
    samplePayload: { minVsAvg: 3, persistTagged: true },
  },
  {
    id: 'multi-channel-collect',
    researchNo: 3,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '경쟁 채널 다중 추적',
    description:
      '«YouTube 채널 데이터 수집» n8n 워크플로가 등록 채널 전체를 순회 수집합니다. 별도 Webhook 불필요.',
    category: 'trend',
    status: 'done',
    coreNodes: 'Loop · YouTube API',
    expectedEffect: '채널 5~10개 동시 모니터링 (W01 youtube-collect에 포함됨)',
    webhookPath: 'youtube-collect',
    coveredByWebhookPath: 'youtube-collect',
    n8nWorkflowFile: 'N8N_YOUTUBE_COLLECT.json',
    envWebhookKey: 'N8N_WEBHOOK_YOUTUBE_COLLECT',
    linkedViewId: 'data-collect',
    integrationMode: 'api',
    api: { method: 'POST', path: '/api/dashboard/collect-all', label: '등록 채널 전체 수집' },
  },
  {
    id: 'naver-blog-collect',
    researchNo: 11,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '네이버 블로그 글 목록 + vs.Avg (전체 파이프라인)',
    description:
      'n8n Webhook → 대시보드가 Naver 검색 Open API로 글 수집 → 조회수·좋아요 갱신. .env에 NAVER_CLIENT_ID/SECRET 필요.',
    category: 'trend',
    status: 'done',
    coreNodes: 'Webhook · HTTP · Naver Search API(대시보드) · 크롤링',
    expectedEffect: '등록 네이버 블로그 자동 수집·vs.Avg',
    webhookPath: 'naver-blog-collect',
    envWebhookKey: 'N8N_WEBHOOK_NAVER_BLOG_COLLECT',
    n8nWorkflowFile: 'N8N_NAVER_BLOG_COLLECT.json',
    linkedViewId: 'naver-blog',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/dashboard/collect-platform', label: '네이버 글 수집 (platform=naver-blog)' },
    samplePayload: { platform: 'naver-blog', mineOnly: false },
  },
  {
    id: 'naver-blog-views',
    researchNo: 7,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '네이버 블로그 조회수·vs.Avg 갱신',
    description:
      '글 목록 수집 후 PostTitleList·PostView·좋아요 API로 조회수·반응 수집 → vs.Avg 계산. 조회수 미공개 블로그는 좋아요·댓글 fallback.',
    category: 'trend',
    status: 'done',
    coreNodes: 'Webhook · HTTP · 대시보드 API',
    expectedEffect: '네이버 블로그 Outlier·vs.Avg 분석 가능',
    webhookPath: 'naver-blog-views',
    envWebhookKey: 'N8N_WEBHOOK_NAVER_BLOG_VIEWS',
    n8nWorkflowFile: 'N8N_NAVER_BLOG_VIEWS.json',
    linkedViewId: 'naver-blog',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/dashboard/naver-blog-views', label: '조회수·vs.Avg 갱신' },
    samplePayload: { onlyMissingViews: true, maxPosts: 80, useEngagementFallback: true },
  },
  {
    id: 'tistory-collect',
    researchNo: 12,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '티스토리 글 목록 수집 (RSS)',
    description:
      'n8n Webhook → 대시보드가 RSS 피드로 티스토리 글 목록·날짜·링크 수집 → Supabase videos 저장. API 키 불필요 · 무료.',
    category: 'trend',
    status: 'done',
    coreNodes: 'Webhook · Schedule · HTTP · RSS(대시보드) · Supabase',
    expectedEffect: '등록 티스토리 블로그 글 목록 자동 수집',
    webhookPath: 'tistory-collect',
    envWebhookKey: 'N8N_WEBHOOK_TISTORY_COLLECT',
    n8nWorkflowFile: 'N8N_TISTORY_COLLECT.json',
    linkedViewId: 'tistory',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/dashboard/collect-platform', label: '티스토리 RSS 수집 (platform=tistory)' },
    samplePayload: { platform: 'tistory', mineOnly: false },
  },
  {
    id: 'rss-topic-collect',
    researchNo: 8,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: 'RSS → 주제 후보 자동 수집',
    description: '뉴스 RSS 수집 → 키워드·(선택) Claude 정제 → rss_topic_candidates 저장',
    category: 'content',
    status: 'done',
    coreNodes: 'RSS · Code · Supabase · (선택) Claude',
    expectedEffect: '매일 주제 리스트 자동 생성',
    webhookPath: 'rss-topic-collect',
    envWebhookKey: 'N8N_WEBHOOK_RSS_TOPICS',
    n8nWorkflowFile: 'N8N_RSS_TOPIC_COLLECT.json',
    linkedViewId: 'content-guide',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/dashboard/rss-topics', label: 'RSS 주제 수집' },
    samplePayload: { targetAudience: '시니어', maxTopics: 5, persistCollected: true },
  },
  {
    id: 'longform-script',
    researchNo: 9,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '콘텐츠 가이드 AI 생성 (글·이미지·영상)',
    description:
      '발행 주제(필수) + (선택) 레퍼런스 → W08 n8n Gemini 1순위, 실패 시 content-generate 폴백. writing/blog·image/carousel·video/longform 초안을 콘텐츠 가이드에서 생성.',
    category: 'content',
    status: 'done',
    coreNodes: 'Webhook · Gemini API · script-guide · content-generate 폴백',
    expectedEffect: '기획→초안 작성 시간 80% 단축',
    webhookPath: 'longform-script',
    envWebhookKey: 'N8N_WEBHOOK_LONGFORM_SCRIPT',
    n8nWorkflowFile: 'N8N_LONGFORM_SCRIPT.json',
    linkedViewId: 'content-guide',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/dashboard/script-guide', label: '스크립트 가이드 생성' },
    samplePayload: {
      context: {
        category: 'writing',
        intent: 'blog',
        userTopic: '삼성전자 단기 전망',
        keywords: ['삼성전자 단기 전망'],
        referenceTitles: [],
      },
    },
  },
  {
    id: 'content-polish',
    researchNo: 25,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '내 콘텐츠화 (발행용 정재)',
    description:
      '가이드 초안 → 레퍼런스·채널명 제거, 발행 톤 정재. 블로그(writing)는 📷 이미지·표 가이드 블록 삽입. n8n 없이 대시보드 Gemini API.',
    category: 'content',
    status: 'done',
    coreNodes: '대시보드 API · Gemini · content-polish',
    expectedEffect: '벤치마킹 흔적 제거·발행 직전 품질 확보',
    webhookPath: 'content-polish-dashboard',
    linkedViewId: 'content-guide',
    integrationMode: 'api',
    api: { method: 'POST', path: '/api/dashboard/content-polish', label: '내 콘텐츠화' },
  },
  {
    id: 'generation-history',
    researchNo: 26,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '콘텐츠 생성 히스토리 (Supabase)',
    description:
      '생성 원본(draft)과 내 콘텐츠화(polished)를 Supabase content_generation_history에 영구 저장·검색. n8n 불필요.',
    category: 'ops',
    status: 'done',
    coreNodes: 'Supabase · generation-history API',
    expectedEffect: '생성물 누적·재활용·PC 이전 시 데이터 유지',
    webhookPath: 'generation-history-dashboard',
    linkedViewId: 'generation-history',
    integrationMode: 'api',
    api: { method: 'GET', path: '/api/dashboard/generation-history', label: '히스토리 조회' },
  },
  {
    id: 'carousel-slide-visual-guide',
    researchNo: 27,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '캐러셀 슬라이드 비주얼 가이드',
    description:
      '이미지 탭 «내 콘텐츠화» 시 슬라이드별 레이아웃·색·텍스트 배치 가이드 삽입 (블로그 📷 가이드와 동급). 현재 content-polish는 writing/blog만 지원.',
    category: 'content',
    status: 'next',
    coreNodes: 'content-polish 확장 · Gemini',
    expectedEffect: '캐러셀 제작 시 Canva·Figma 작업 지시서 자동화',
    webhookPath: 'carousel-visual-guide',
    linkedViewId: 'content-guide',
    integrationMode: 'roadmap',
  },
  {
    id: 'video-scene-guide',
    researchNo: 28,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '영상 B-roll·썸네일 가이드',
    description:
      '영상 탭 «내 콘텐츠화» 시 컷별 B-roll/자막/썸네일 문구 가이드 삽입. 현재 미구현 — thumbnail-ab-text(n8n)와 보완 관계.',
    category: 'content',
    status: 'next',
    coreNodes: 'content-polish 확장 · Gemini',
    expectedEffect: '촬영·편집·썸네일 기획 시간 절감',
    webhookPath: 'video-scene-guide',
    linkedViewId: 'content-guide',
    integrationMode: 'roadmap',
  },
  {
    id: 'blog-auto-publish',
    researchNo: 16,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '블로그 자동 발행',
    description: '완성 스크립트 → 블로그용 재구성 → 네이버·티스토리 자동 발행',
    category: 'deploy',
    status: 'soon',
    coreNodes: 'Claude · Tistory API · Naver API',
    expectedEffect: '영상 1편 → 블로그 1편 자동 변환',
    webhookPath: 'blog-auto-publish',
    linkedViewId: 'deploy',
    integrationMode: 'roadmap',
  },
  {
    id: 'sns-caption-schedule',
    researchNo: 17,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: 'SNS 캡션·해시태그 자동 생성 + 예약',
    description:
      '플랫폼별 캡션·해시태그 → Buffer/Later 예약. ⚠️ content-generate(sns-caption)으로 초안 가능 — 예약·멀티 플랫폼 발행 연동이 n8n 가치.',
    category: 'deploy',
    status: 'soon',
    coreNodes: 'Claude · Buffer API',
    expectedEffect: 'SNS 발행 시간 90% 단축',
    webhookPath: 'sns-caption-schedule',
    linkedViewId: 'deploy',
    integrationMode: 'roadmap',
  },
  {
    id: 'credit-monitor',
    researchNo: 22,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '크레딧·툴 비용 모니터링',
    description: 'Freepik·Kling 등 크레딧 잔량 주기 체크 → 소진 임박 시 슬랙 알림',
    category: 'ops',
    status: 'soon',
    coreNodes: 'HTTP · Schedule · Slack',
    expectedEffect: '크레딧 소진 사고 방지',
    webhookPath: 'credit-monitor',
    linkedViewId: 'settings',
    integrationMode: 'roadmap',
  },
  // ── 2단계 (Lv.2) ──
  {
    id: 'apify-crawl',
    researchNo: 4,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: 'Apify 유튜브·인스타 크롤링',
    description: 'Apify Actor로 키워드·채널 데이터 수집 → Supabase 누적 저장',
    category: 'trend',
    status: 'soon',
    coreNodes: 'Apify · Supabase',
    expectedEffect: '외부 트렌드 데이터 확보',
    webhookPath: 'apify-crawl',
    linkedViewId: 'tiktok',
    integrationMode: 'roadmap',
  },
  {
    id: 'trend-keyword-monitor',
    researchNo: 5,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: '구글 트렌드·네이버 실검 모니터링',
    description: '30분 주기 급상승 키워드 감지 → 시니어 타겟 관련 시 즉시 알림',
    category: 'trend',
    status: 'soon',
    coreNodes: 'HTTP · Schedule · Slack',
    expectedEffect: '시사 콘텐츠 타이밍 선점',
    webhookPath: 'trend-keyword-monitor',
    linkedViewId: 'trending',
    integrationMode: 'roadmap',
  },
  {
    id: 'weekly-trend-report',
    researchNo: 6,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: '주간 트렌드 자동 리포트',
    description: '매주 월요일 지난 주 데이터 집계 → Claude 분석 → Notion 문서 자동 생성',
    category: 'trend',
    status: 'soon',
    coreNodes: 'Schedule · Claude · Notion',
    expectedEffect: '매주 기획 자료 자동 완성',
    webhookPath: 'weekly-trend-report',
    linkedViewId: 'ai-insight',
    integrationMode: 'roadmap',
  },
  {
    id: 'shorts-script',
    researchNo: 10,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: '쇼츠 전용 스크립트 생성',
    description:
      '60초 훅→핵심→반전→CTA Agent. ⚠️ content-generate(shortform)으로 가이드·제작 탭에서 초안 생성 가능 — n8n 전용화는 후순위.',
    category: 'content',
    status: 'later',
    coreNodes: 'Claude · Webhook',
    expectedEffect: '쇼츠 제작 사이클 단축',
    webhookPath: 'shorts-script',
    linkedViewId: 'content-studio',
    integrationMode: 'roadmap',
  },
  {
    id: 'insta-toon-ideas',
    researchNo: 11,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: '인스타툰 소재 자동 수집·구성',
    description:
      '경제 이슈 → 4컷 시나리오·대사. ⚠️ 가이드 «이미지» 탭 carousel 생성과 부분 중복 — 인스타툰 전용 포맷·비주얼 가이드 보강 후 검토.',
    category: 'content',
    status: 'later',
    coreNodes: 'Claude · Notion',
    expectedEffect: '인스타툰 기획 시간 절감',
    webhookPath: 'insta-toon-ideas',
    linkedViewId: 'content-guide',
    integrationMode: 'roadmap',
  },
  {
    id: 'thumbnail-ab-text',
    researchNo: 12,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: '썸네일 텍스트 A/B 후보 생성',
    description: '영상 제목 입력 → 클릭률 높은 썸네일 문구 5개 + 근거 자동 생성',
    category: 'content',
    status: 'soon',
    coreNodes: 'Claude · Webhook',
    expectedEffect: '썸네일 기획 시간 절감',
    webhookPath: 'thumbnail-ab-text',
    linkedViewId: 'content-studio',
    integrationMode: 'roadmap',
  },
  {
    id: 'seo-review',
    researchNo: 18,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: 'SEO 자동 최적화 검수',
    description:
      '발행 전 SEO 점검·수정 제안. ⚠️ blog 생성·content-polish H2/키워드 규칙과 부분 중복 — 자동 점수·검수 리포트 n8n은 유효.',
    category: 'deploy',
    status: 'soon',
    coreNodes: 'Claude · Webhook',
    expectedEffect: '블로그 검색 노출 향상',
    webhookPath: 'seo-review',
    linkedViewId: 'deploy',
    integrationMode: 'roadmap',
  },
  {
    id: 'youtube-performance-report',
    researchNo: 21,
    stage: 2,
    researchLevel: 'lv2',
    n8nScenarioName: '유튜브 성과 자동 분석 리포트',
    description: '매주 Studio API → 조회수·CTR·시청지속률 → Claude 분석 → Notion',
    category: 'ops',
    status: 'soon',
    coreNodes: 'YouTube Analytics · Claude · Notion',
    expectedEffect: '채널 성과 데이터 자동 축적',
    webhookPath: 'youtube-performance-report',
    linkedViewId: 'revenue',
    integrationMode: 'roadmap',
  },
  // ── 3단계 (Lv.3 + Agent) ──
  {
    id: 'outlier-pattern-agent',
    researchNo: 7,
    stage: 3,
    researchLevel: 'agent',
    n8nScenarioName: '아웃라이어 패턴 분석 Agent',
    description: '아웃라이어 영상 메타를 Agent가 종합 분석 → 공통 패턴 추출',
    category: 'trend',
    status: 'later',
    coreNodes: 'AI Agent · Supabase · Claude',
    expectedEffect: '데이터 기반 제목·썸네일 전략',
    webhookPath: 'outlier-pattern-agent',
    linkedViewId: 'outlier',
    integrationMode: 'roadmap',
  },
  {
    id: 'multi-agent-script-review',
    researchNo: 13,
    stage: 3,
    researchLevel: 'agent',
    n8nScenarioName: '멀티 Agent 스크립트 검토',
    description:
      '기획→비판→수정 Agent 체인. ⚠️ «내 콘텐츠화»(content-polish)가 1차 정재·레퍼런스 제거를 담당 — 멀티 Agent는 장기.',
    category: 'content',
    status: 'later',
    coreNodes: 'AI Agent Chain · Claude',
    expectedEffect: '스크립트 퀄리티 자동 검증',
    webhookPath: 'multi-agent-script-review',
    linkedViewId: 'content-studio',
    integrationMode: 'roadmap',
  },
  {
    id: 'monthly-content-calendar',
    researchNo: 14,
    stage: 3,
    researchLevel: 'agent',
    n8nScenarioName: '월간 콘텐츠 캘린더 자동 생성',
    description: '월초 트렌드·시즌·경쟁 채널 종합 → 한 달치 Notion 캘린더 등록',
    category: 'content',
    status: 'later',
    coreNodes: 'Schedule · Claude · Notion Calendar',
    expectedEffect: '한 달 기획 1회 자동 완성',
    webhookPath: 'monthly-content-calendar',
    linkedViewId: 'calendar',
    integrationMode: 'roadmap',
  },
  {
    id: 'topic-recommend-agent',
    researchNo: 15,
    stage: 1,
    researchLevel: 'lv1',
    n8nScenarioName: '주제 추천 AI (RSS + Outlier + Gemini)',
    description: 'RSS 트렌드 + 아웃라이어 데이터 → Gemini가 이번 주 추천 주제 5개 + 제목·이유 생성',
    category: 'trend',
    status: 'done',
    coreNodes: 'Webhook · HTTP · Gemini API · 대시보드 API',
    expectedEffect: '데이터 기반 주제 선정 자동화',
    webhookPath: 'topic-suggest',
    envWebhookKey: 'N8N_WEBHOOK_TOPIC_SUGGEST',
    n8nWorkflowFile: 'N8N_TOPIC_SUGGEST_V2.json',
    linkedViewId: 'topic-suggest',
    integrationMode: 'hybrid',
    api: { method: 'POST', path: '/api/topic-suggest', label: '주제 추천 AI 실행' },
    samplePayload: { count: 5, targetAudience: '시니어', includeRss: true, includeOutlier: true },
  },
  {
    id: 'multipurpose-pipeline',
    researchNo: 19,
    stage: 3,
    researchLevel: 'lv3',
    n8nScenarioName: '원소스 멀티유즈 풀 파이프라인',
    description:
      '원본 1개 → 멀티 포맷 동시 생성·예약. ⚠️ content-generate 변환·Repurpose UI는 부분 구현 — 발행·스케줄 n8n 오케스트레이션은 장기.',
    category: 'deploy',
    status: 'later',
    coreNodes: 'Claude · n8n 전체 · 멀티 API',
    expectedEffect: '콘텐츠 1개 → 6개 플랫폼 동시 발행',
    webhookPath: 'multipurpose-pipeline',
    linkedViewId: 'repurpose',
    integrationMode: 'roadmap',
  },
  {
    id: 'thumbnail-ab-swap',
    researchNo: 20,
    stage: 3,
    researchLevel: 'lv3',
    n8nScenarioName: '썸네일 A/B 자동 교체',
    description: '썸네일 2개 등록 → 48시간 후 CTR 비교 → 낮은 쪽 자동 교체',
    category: 'deploy',
    status: 'later',
    coreNodes: 'YouTube API · Schedule · IF 노드',
    expectedEffect: '클릭률 자동 최적화',
    webhookPath: 'thumbnail-ab-swap',
    linkedViewId: 'deploy',
    integrationMode: 'roadmap',
  },
  {
    id: 'comment-sentiment',
    researchNo: 23,
    stage: 3,
    researchLevel: 'lv3',
    n8nScenarioName: '댓글 감성 분석 → 기획 반영',
    description: '댓글 주기 수집 → 감성 분석 → 후속 주제·불만 포인트 추출',
    category: 'ops',
    status: 'later',
    coreNodes: 'YouTube API · Claude · Notion',
    expectedEffect: '시청자 니즈 기반 콘텐츠 개선',
    webhookPath: 'comment-sentiment',
    linkedViewId: 'ai-insight',
    integrationMode: 'roadmap',
  },
  {
    id: 'revenue-dashboard-sync',
    researchNo: 24,
    stage: 3,
    researchLevel: 'lv3',
    n8nScenarioName: '수익 통합 대시보드 자동 업데이트',
    description: '유튜브·애드센스·쿠팡파트너스 수익 매일 수집 → 합산·ROI 계산',
    category: 'ops',
    status: 'later',
    coreNodes: '멀티 API · Google Sheets · Claude',
    expectedEffect: '수익 현황 실시간 파악',
    webhookPath: 'revenue-dashboard-sync',
    linkedViewId: 'revenue',
    integrationMode: 'roadmap',
  },
]

export function getServicesByStage(stage: AutomationStage): N8nAutomationService[] {
  return N8N_AUTOMATION_ROADMAP.filter((s) => s.stage === stage)
}

export function getAutomationService(id: string): N8nAutomationService | undefined {
  return N8N_AUTOMATION_ROADMAP.find((s) => s.id === id)
}

export function getServicesByView(viewId: string): N8nAutomationService[] {
  return N8N_AUTOMATION_ROADMAP.filter((s) => s.linkedViewId === viewId)
}

export function getServicesByCategory(category: RoadmapCategory): N8nAutomationService[] {
  return N8N_AUTOMATION_ROADMAP.filter((s) => s.category === category)
}

/** 동일 n8n Webhook으로 이미 커버된 로드맵 카드는 워크플로 UI에서 제외 */
export function filterRoadmapServicesForWorkflowUi(
  services: N8nAutomationService[],
  activeWebhookPaths: ReadonlySet<string>,
): N8nAutomationService[] {
  return services.filter((s) => {
    if (!s.coveredByWebhookPath) return true
    return !activeWebhookPaths.has(s.coveredByWebhookPath)
  })
}

export const ROADMAP_CATEGORY_TABS: { id: RoadmapCategory; label: string; icon: string }[] = [
  { id: 'trend', label: '트렌드·수집', icon: '📊' },
  { id: 'content', label: '콘텐츠 기획', icon: '✍️' },
  { id: 'deploy', label: '배포·발행', icon: '📡' },
  { id: 'ops', label: '운영·수익', icon: '⚙️' },
]

/** 대시보드에서 실행·연동 가능 여부 (워크플로 관리 UI용) */
export type WorkflowImplementationStatus = 'implemented' | 'partial' | 'unimplemented'

/**
 * @param activeWebhookPaths n8n에서 실제 등록된 Webhook path 집합 (n8n-status API)
 * 구현됨 = 이 집합에 service.webhookPath 가 있을 때만
 */
export function getWorkflowImplementationStatus(
  service: N8nAutomationService,
  activeWebhookPaths: ReadonlySet<string> = new Set(),
): WorkflowImplementationStatus {
  if (activeWebhookPaths.has(service.webhookPath)) return 'implemented'
  if (service.status === 'done' && service.integrationMode === 'api' && service.api) return 'implemented'
  if (service.integrationMode === 'roadmap') return 'unimplemented'
  if (service.integrationMode === 'dummy') return 'partial'
  if (service.integrationMode === 'api' || service.integrationMode === 'hybrid') return 'partial'
  return 'unimplemented'
}

export function isWorkflowRunnable(
  service: N8nAutomationService,
  activeWebhookPaths: ReadonlySet<string> = new Set(),
): boolean {
  if (activeWebhookPaths.has(service.webhookPath)) return true
  if (service.integrationMode === 'api' && service.api) return true
  if (service.integrationMode === 'dummy') return true
  if (service.integrationMode === 'hybrid') return true
  return false
}

const IMPLEMENTATION_META: Record<
  WorkflowImplementationStatus,
  { label: string; shortLabel: string; hint: string }
> = {
  implemented: {
    label: '구현됨',
    shortLabel: 'n8n 활성',
    hint: 'Docker n8n에 Webhook이 등록·활성화되어 있습니다. «서비스 실행»으로 실제 워크플로를 호출합니다.',
  },
  partial: {
    label: '부분 구현',
    shortLabel: '대기',
    hint: '로드맵·대시보드 API·더미만 있거나 n8n Webhook이 아직 비활성입니다.',
  },
  unimplemented: {
    label: '미구현',
    shortLabel: '예정',
    hint: '로드맵 항목입니다. n8n 시나리오 설계·연동 후 실행 가능해집니다.',
  },
}

export function getWorkflowImplementationMeta(status: WorkflowImplementationStatus) {
  return IMPLEMENTATION_META[status]
}

export function getCategoryLabel(cat: RoadmapCategory): string {
  const map: Record<RoadmapCategory, string> = {
    trend: '트렌드 분석',
    content: '콘텐츠 기획',
    deploy: '배포·발행',
    ops: '운영·관리',
  }
  return map[cat]
}

export function getStatusLabel(status: RoadmapStatus): string {
  const map: Record<RoadmapStatus, string> = {
    done: '✅ 완료',
    next: '🟢 다음 스텝',
    soon: '🟡 3개월 후',
    later: '🔵 6개월 후',
  }
  return map[status]
}
