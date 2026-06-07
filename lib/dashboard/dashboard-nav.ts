/**
 * 사이드바 트리 + 페이지 헤더(제목·설명·플랫폼 필터) 단일 소스.
 * 새 화면 추가 시 이 파일만 갱신하면 메타·네비가 함께 맞춰집니다.
 */

export interface DashboardNavItem {
  id: string
  label: string
  icon: string
  children?: DashboardNavItem[]
  badge?: number | string
  badgeColor?: string
}

export type ViewVideoFormat = 'short' | 'long'

export interface ViewMeta {
  title: string
  desc: string
  /** PlatformView 등에서 사용하는 dashboard-types platform 값 */
  filter?: string
  /** YouTube Shorts(≤180초) / 롱폼 구분 */
  videoFormat?: ViewVideoFormat
  /** true면 «내 채널»(is_mine)만 표시·수집 */
  mineOnly?: boolean
}

function mineViewMeta(base: ViewMeta & { filter: string }): ViewMeta {
  return {
    ...base,
    mineOnly: true,
    title: base.title.startsWith('내 ') ? base.title : `내 ${base.title}`,
    desc:
      '내가 운영하는 채널의 업로드·수집 콘텐츠만 표시합니다. «운영 허브»에서 «내 채널»로 지정한 항목이 대상입니다.',
  }
}

/** URL `?view=` 값 → 헤더 메타. 그룹 전용 id(analysis 등)도 헤더 혼동을 줄이기 위해 포함 */
export const VIEW_META: Record<string, ViewMeta> = {
  overview: { title: '전체 개요', desc: '모든 플랫폼의 콘텐츠 분석 현황' },
  analysis: {
    title: '콘텐츠 분석',
    desc: 'YouTube·네이버 블로그·티스토리 레퍼런스를 한 화면에서 비교합니다. 숏폼 참고·vs.Avg는 YouTube Shorts를 사용하세요.',
  },
  'publish-expand': {
    title: '발행 확장',
    desc: '완성 콘텐츠를 TikTok·Instagram·Google Blogger 등 다른 채널로 보낼 때 포맷·SEO·발행 체크리스트를 참고합니다.',
  },
  youtube: {
    title: 'YouTube',
    desc: '등록한 채널의 카테고리(육아·경제 등)로 필터해 콘텐츠를 볼 수 있습니다. 카테고리는 «채널·콘텐츠 등록»에서 지정합니다.',
    filter: 'youtube',
  },
  'youtube-shorts': {
    title: 'YouTube Shorts',
    desc: '영상 길이 3분 이하(또는 #Shorts)로 분류된 숏폼만 표시합니다. vs.Avg는 같은 채널의 Shorts 평균 조회수 기준입니다.',
    filter: 'youtube',
    videoFormat: 'short',
  },
  'youtube-longform': {
    title: 'YouTube 롱폼',
    desc: '3분 초과 롱폼 영상만 표시합니다. vs.Avg는 같은 채널의 롱폼 평균 조회수 기준입니다.',
    filter: 'youtube',
    videoFormat: 'long',
  },
  tiktok: {
    title: 'TikTok 발행 확장',
    desc: 'YouTube Shorts 완성본을 TikTok 업로드용으로 변환·발행할 때 참고합니다. 레퍼런스·vs.Avg 분석은 YouTube Shorts를 사용하세요.',
    filter: 'tiktok',
    videoFormat: 'short',
  },
  instagram: {
    title: 'Instagram 발행 확장',
    desc: 'Reels·캐러셀 발행 포맷·스펙 안내. 레퍼런스 분석은 YouTube Shorts 기준입니다.',
    filter: 'instagram',
  },
  'instagram-reels': {
    title: 'Instagram Reels',
    desc: 'Shorts 완성본을 Reels로 발행할 때의 포맷·캡션·안전 영역 가이드입니다.',
    filter: 'instagram',
    videoFormat: 'short',
  },
  'instagram-carousel': {
    title: '캐러셀 포스트',
    desc: '카드뉴스·인포그래픽 캐러셀 발행 흐름·장수·CTA 설계 가이드입니다.',
    filter: 'instagram',
  },
  blogger: {
    title: 'Google Blogger 발행 확장',
    desc: '네이버 블로그·콘텐츠 가이드 초안을 Blogger(blogspot)에 발행할 때의 Google SEO·메타·AdSense 체크리스트입니다.',
    filter: 'blogger',
  },
  'naver-blog': { title: '네이버 블로그', desc: '네이버 블로그 분석', filter: 'naver-blog' },
  tistory: { title: '티스토리', desc: '티스토리 분석', filter: 'tistory' },
  insights: { title: '기획 / 인사이트', desc: '트렌드·Outlier·AI 기획 등 인사이트 메뉴입니다.' },
  trending: { title: '트렌딩 키워드', desc: '급상승 키워드 및 트렌드' },
  outlier: { title: 'Outlier 분석', desc: 'vs.Avg 3.0x 이상 콘텐츠' },
  'ai-insight': { title: 'AI 인사이트', desc: 'AI 기반 콘텐츠 기획 추천' },
  benchmark: { title: '채널·콘텐츠 등록', desc: '수집·분석 대상 채널과 레퍼런스 콘텐츠를 등록합니다.' },
  'channel-register': {
    title: '채널 등록·관리',
    desc: '분석 대상 채널과 레퍼런스 콘텐츠를 등록·수집합니다.',
  },
  'my-channels': {
    title: '내 채널',
    desc: '내가 운영하는 채널·콘텐츠를 플랫폼별로 종합 관리합니다. 하위 메뉴에서 캘린더·통계를 선택하세요.',
  },
  'channels-mine': {
    title: '운영 허브',
    desc: '내가 운영하는 채널을 지정하고, 구독자·목표·하위 플랫폼 통계로 이동합니다.',
  },
  calendar: {
    title: '콘텐츠 캘린더',
    desc: '내가 운영하는 콘텐츠의 제작·업로드 일정을 관리합니다.',
  },
  'my-youtube': mineViewMeta({
    title: 'YouTube',
    desc: '',
    filter: 'youtube',
  }),
  'my-youtube-shorts': mineViewMeta({
    title: 'YouTube Shorts',
    desc: '',
    filter: 'youtube',
    videoFormat: 'short',
  }),
  'my-youtube-longform': mineViewMeta({
    title: 'YouTube 롱폼',
    desc: '',
    filter: 'youtube',
    videoFormat: 'long',
  }),
  'my-tiktok': {
    ...mineViewMeta({ title: 'TikTok', desc: '', filter: 'tiktok', videoFormat: 'short' }),
    title: '내 TikTok',
    desc: '내 TikTok 발행 일정·업로드는 캘린더·발행 편집에서 관리하세요. 레퍼런스 분석은 YouTube Shorts를 사용합니다.',
  },
  'my-instagram': {
    ...mineViewMeta({ title: 'Instagram', desc: '', filter: 'instagram' }),
    title: '내 Instagram',
    desc: 'Reels·캐러셀 발행 포맷 가이드. 레퍼런스 분석은 YouTube Shorts를 사용합니다.',
  },
  'my-instagram-reels': {
    ...mineViewMeta({ title: 'Instagram Reels', desc: '', filter: 'instagram', videoFormat: 'short' }),
    title: '내 Instagram Reels',
    desc: 'Shorts 완성본 → Reels 발행 시 참고. 업로드 일정은 캘린더에서 관리하세요.',
  },
  'my-instagram-carousel': {
    ...mineViewMeta({ title: '캐러셀 포스트', desc: '', filter: 'instagram' }),
    title: '내 캐러셀',
    desc: '카드뉴스·캐러셀 발행 흐름 가이드. 분석·수집은 제공하지 않습니다.',
  },
  'my-blogger': {
    ...mineViewMeta({ title: 'Google Blogger', desc: '', filter: 'blogger' }),
    title: '내 Google Blogger',
    desc: '네이버 발행 글의 Google 검색·AdSense 미러 채널. 업로드 일정은 캘린더에서 관리하세요.',
  },
  'my-naver-blog': mineViewMeta({ title: '네이버 블로그', desc: '', filter: 'naver-blog' }),
  'my-tistory': mineViewMeta({ title: '티스토리', desc: '', filter: 'tistory' }),
  pipeline: { title: '파이프라인', desc: '콘텐츠 생산 자동화 현황' },
  repurpose: { title: 'Repurposing', desc: 'Outlier 콘텐츠 멀티 플랫폼 재가공' },
  deploy: { title: '배포 자동화', desc: 'n8n 기반 멀티채널 자동 배포' },
  'data-collect': { title: '데이터 수집', desc: 'API 및 크롤링 수집 관리' },
  revenue: { title: '수익 추적', desc: '플랫폼별 수익 및 로드맵' },
  'topic-suggest': { title: '주제 선별 AI', desc: '레퍼런스 분석 기반 콘텐츠 주제 추천' },
  automation: {
    title: '워크플로 관리',
    desc: '연동된 n8n 워크플로를 카테고리별로 확인하고 Webhook·API로 실행합니다. 편집기 로그인 없이 대시보드에서 바로 실행할 수 있습니다.',
  },
  settings: { title: '설정', desc: '테마 및 대시보드 환경 설정' },
  create: { title: '콘텐츠 만들기', desc: '가이드에서 발행용 스크립트 생성 → (선택) 편집·변환 → 히스토리 보관.' },
  'content-guide': {
    title: '콘텐츠 가이드',
    desc: '발행 주제·레퍼런스·가이드라인(MD) 기반으로 발행용 스크립트·본문을 한 번에 생성합니다. 숏폼은 Flow 씬별 붙여넣기 블록까지 포함합니다.',
  },
  'content-studio': {
    title: '발행 편집·변환',
    desc: '가이드에서 만든 본문을 최종 수정·메모하고, 블로그↔숏폼 등 포맷 변환 초안을 만듭니다. (localStorage)',
  },
  'generation-history': {
    title: '히스토리 관리',
    desc: '콘텐츠 가이드에서 생성·저장한 발행용 결과를 Supabase에서 검색·복사·재활용합니다.',
  },
  n8n: {
    title: 'n8n',
    desc: '자동화 로드맵과 워크플로 실행·관리 메뉴입니다.',
  },
  'n8n-lv1': {
    title: 'n8n 자동화 로드맵',
    desc: 'Research 기준 1·2·3단계 자동화 목록. 탭으로 단계를 전환하고, 각 카드에서 n8n 시나리오(자동화 이름)를 확인·실행합니다.',
  },
}

/** 자식만 있고 단독 화면이 없는 그룹 메뉴 — 클릭 시 펼치기만 */
export const NAV_EXPAND_ONLY_IDS = new Set([
  'insights',
  'my-channels',
  'channel-register',
  'n8n',
  'create',
  'pipeline',
  'publish-expand',
])

export function isNavExpandOnly(id: string): boolean {
  return NAV_EXPAND_ONLY_IDS.has(id)
}

export function resolveViewMeta(view: string): ViewMeta {
  return (
    VIEW_META[view] ?? {
      title: '준비 중',
      desc: '이 메뉴는 하위 항목을 선택하거나, 화면 연결이 아직 없을 수 있습니다.',
    }
  )
}

/** `lib/dummy-data` 등 정적 데이터만 쓰는 화면 — 사이드바 (더미) 표시 */
export const NAV_DUMMY_ONLY_VIEW_IDS = new Set<string>([])

/** API + localStorage 혼합 등 — (일부 더미) */
export const NAV_PARTIAL_DUMMY_VIEW_IDS = new Set<string>(['automation', 'content-guide', 'n8n-lv1'])

export type NavDataBadge = 'none' | 'dummy' | 'partial'

export function getNavDataBadge(viewId: string): NavDataBadge {
  if (NAV_DUMMY_ONLY_VIEW_IDS.has(viewId)) return 'dummy'
  if (NAV_PARTIAL_DUMMY_VIEW_IDS.has(viewId)) return 'partial'
  return 'none'
}

export const NAV_TREE: DashboardNavItem[] = [
  {
    id: 'n8n',
    label: 'n8n',
    icon: '🔧',
    badge: '허브',
    badgeColor: 'bg-purple-100 text-purple-700',
    children: [
      { id: 'n8n-lv1', label: '자동화 로드맵', icon: '🗺️', badge: '3단계', badgeColor: 'bg-violet-100 text-violet-800' },
      { id: 'automation', label: '워크플로 관리', icon: '▶️' },
    ],
  },
  {
    id: 'create',
    label: '콘텐츠 만들기',
    icon: '✨',
    children: [
      { id: 'content-guide', label: '콘텐츠 가이드', icon: '📋' },
      { id: 'content-studio', label: '발행 편집·변환', icon: '✍️' },
      { id: 'generation-history', label: '히스토리 관리', icon: '📚' },
    ],
  },
  {
    id: 'channel-register',
    label: '채널 등록·관리',
    icon: '📝',
    badge: '핵심',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
    children: [
      {
        id: 'benchmark',
        label: '채널·콘텐츠 등록',
        icon: '➕',
        badge: '등록',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
      },
    ],
  },
  {
    id: 'analysis',
    label: '콘텐츠 분석',
    icon: '📊',
    children: [
      {
        id: 'youtube',
        label: 'YouTube',
        icon: '🔴',
        badge: 7,
        children: [
          { id: 'youtube-shorts', label: 'Shorts', icon: '⚡' },
          { id: 'youtube-longform', label: '롱폼', icon: '🎬' },
        ],
      },
      { id: 'naver-blog', label: '네이버 블로그', icon: '🟢', badge: 1 },
      { id: 'tistory', label: '티스토리', icon: '🟠', badge: 1 },
    ],
  },
  {
    id: 'insights',
    label: '기획 / 인사이트',
    icon: '💡',
    children: [
      { id: 'trending', label: '트렌딩 키워드', icon: '🔥' },
      { id: 'outlier', label: 'Outlier 분석', icon: '🚀' },
      { id: 'ai-insight', label: 'AI 인사이트', icon: '🤖' },
      {
        id: 'topic-suggest',
        label: '주제 선별 AI',
        icon: '🎯',
        badge: 'NEW',
        badgeColor: 'bg-green-100 text-green-700',
      },
    ],
  },
  {
    id: 'my-channels',
    label: '내 채널',
    icon: '📺',
    badge: '허브',
    badgeColor: 'bg-blue-100 text-blue-700',
    children: [
      { id: 'channels-mine', label: '운영 허브', icon: '🏠' },
      {
        id: 'calendar',
        label: '콘텐츠 캘린더',
        icon: '🗓️',
        badge: '3건',
        badgeColor: 'bg-blue-100 text-blue-700',
      },
      {
        id: 'my-youtube',
        label: 'YouTube',
        icon: '🔴',
        children: [
          { id: 'my-youtube-shorts', label: 'Shorts', icon: '⚡' },
          { id: 'my-youtube-longform', label: '롱폼', icon: '🎬' },
        ],
      },
      {
        id: 'my-tiktok',
        label: 'TikTok',
        icon: '🎵',
        badge: '발행',
        badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
      },
      {
        id: 'my-instagram',
        label: 'Instagram',
        icon: '💗',
        badge: '발행',
        badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
        children: [
          { id: 'my-instagram-reels', label: 'Reels', icon: '🎵' },
          { id: 'my-instagram-carousel', label: '캐러셀', icon: '🖼️' },
        ],
      },
      { id: 'my-naver-blog', label: '네이버 블로그', icon: '🟢' },
      {
        id: 'my-blogger',
        label: 'Google Blogger',
        icon: '🌐',
        badge: '발행',
        badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
      },
      { id: 'my-tistory', label: '티스토리', icon: '🟠' },
    ],
  },
  {
    id: 'publish-expand',
    label: '발행 확장',
    icon: '📤',
    badge: '멀티',
    badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
    children: [
      {
        id: 'tiktok',
        label: 'TikTok',
        icon: '🎵',
        badge: '발행',
        badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
      },
      {
        id: 'instagram',
        label: 'Instagram',
        icon: '💗',
        badge: '발행',
        badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
        children: [
          { id: 'instagram-reels', label: 'Reels', icon: '🎵' },
          { id: 'instagram-carousel', label: '캐러셀', icon: '🖼️' },
        ],
      },
      {
        id: 'blogger',
        label: 'Google Blogger',
        icon: '🌐',
        badge: '발행',
        badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
      },
    ],
  },
  {
    id: 'pipeline',
    label: '파이프라인',
    icon: '⚙️',
    children: [
      { id: 'repurpose', label: 'Repurposing', icon: '🔄' },
      { id: 'deploy', label: '배포 자동화', icon: '📤' },
      {
        id: 'data-collect',
        label: '데이터 수집',
        icon: '🤖',
        badge: '●',
        badgeColor: 'bg-green-100 text-green-600',
      },
    ],
  },
  { id: 'revenue', label: '수익 추적', icon: '💰' },
]
