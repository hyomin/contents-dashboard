import type { Video } from './dashboard-types'

export const ALL_VIDEOS: Video[] = [
  { id: 1,  tier: 'S', title: '경제 뉴스 분석 - 2024년 전망',    channel: 'Travel Tube',    views: 150000, vsAvg: 5.2, platform: 'youtube',    publishedAt: '2일 전', keyword: '경제' },
  { id: 2,  tier: 'A', title: '부동산 시장 전망과 투자 전략',      channel: 'Travel Tube',    views: 120000, vsAvg: 4.1, platform: 'youtube',    publishedAt: '3일 전', keyword: '부동산' },
  { id: 3,  tier: 'A', title: '주식 투자 가이드 - 초보자 필독',   channel: 'Content Master', views: 95000,  vsAvg: 3.8, platform: 'youtube',    publishedAt: '4일 전', keyword: '주식' },
  { id: 4,  tier: 'B', title: '금 투자 vs 달러 투자 비교',         channel: 'Travel Tube',    views: 80000,  vsAvg: 2.3, platform: 'youtube',    publishedAt: '5일 전', keyword: '투자' },
  { id: 5,  tier: 'B', title: '인스타그램 릴스 트렌드',             channel: 'Social Creator', views: 50000,  vsAvg: 2.5, platform: 'instagram',  publishedAt: '1일 전', keyword: '릴스' },
  { id: 6,  tier: 'C', title: '일상 브이로그',                       channel: 'Daily Life',     views: 25000,  vsAvg: 1.2, platform: 'youtube',    publishedAt: '6일 전', keyword: '일상' },
  { id: 7,  tier: 'A', title: '2024 부동산 투자 가이드',             channel: '경제블로그',     views: 85000,  vsAvg: 3.4, platform: 'naver-blog', publishedAt: '2일 전', keyword: '부동산' },
  { id: 8,  tier: 'B', title: '티스토리 AdSense 수익 공개',         channel: '블로그수익화',   views: 45000,  vsAvg: 2.1, platform: 'tistory',    publishedAt: '4일 전', keyword: '수익' },
  { id: 9,  tier: 'S', title: '금리 인상 시대의 재테크 전략',       channel: 'Money Tube',     views: 200000, vsAvg: 6.1, platform: 'youtube',    publishedAt: '1일 전', keyword: '금리' },
  { id: 10, tier: 'A', title: '노후 대비 연금 완벽 정리',           channel: 'Senior Finance', views: 110000, vsAvg: 3.5, platform: 'youtube',    publishedAt: '3일 전', keyword: '연금' },
]

export const INSIGHTS = [
  { icon: '🔥', text: '"부동산" 키워드가 최근 7일간 230% 급상승 → 관련 콘텐츠 즉시 제작 추천' },
  { icon: '💡', text: '시니어 타겟 경제 뉴스가 평균 5.2x 조회수 → 핵심 타겟층 집중 공략' },
  { icon: '⏰', text: 'YouTube 오후 6~8시 업로드가 평균 대비 2.3x 높은 성과' },
  { icon: '📈', text: '"금리 인상" 키워드 Outlier 6.1x → OSMU 2차 콘텐츠 제작 기회' },
]

export const TRENDING_KEYWORDS = [
  { rank: 1, keyword: '금리 인상',   change: 230, trend: 'up' as const },
  { rank: 2, keyword: '부동산 투자', change: 180, trend: 'up' as const },
  { rank: 3, keyword: '주식 전망',   change: 150, trend: 'up' as const },
  { rank: 4, keyword: '노후 연금',   change: 120, trend: 'up' as const },
  { rank: 5, keyword: '달러 환율',   change: 15,  trend: 'down' as const },
]

export const COMPETITOR_CHANNELS = [
  { id: 1, name: 'Travel Tube',    platform: 'youtube' as const,    subs: 250000, avgViews: 42000, videos: 340, topKeyword: '경제/부동산',     tier: 'A', tracked: true },
  { id: 2, name: 'Money Tube',     platform: 'youtube' as const,    subs: 180000, avgViews: 35000, videos: 210, topKeyword: '재테크/금리',     tier: 'A', tracked: true },
  { id: 3, name: 'Content Master', platform: 'youtube' as const,    subs: 120000, avgViews: 28000, videos: 190, topKeyword: '주식/투자',       tier: 'B', tracked: true },
  { id: 4, name: 'Senior Finance', platform: 'youtube' as const,    subs: 90000,  avgViews: 22000, videos: 150, topKeyword: '연금/노후',       tier: 'B', tracked: false },
  { id: 5, name: '경제블로그',      platform: 'naver-blog' as const, subs: 45000,  avgViews: 8000,  videos: 320, topKeyword: '부동산/경제',     tier: 'B', tracked: true },
  { id: 6, name: '블로그수익화',    platform: 'tistory' as const,    subs: 22000,  avgViews: 4500,  videos: 180, topKeyword: '수익화/AdSense', tier: 'C', tracked: false },
]

export const MY_CHANNELS = [
  { id: 1, name: '내 유튜브 채널',   platform: 'youtube' as const,    subs: 0,   videos: 0, status: '준비중', goal: 1000 },
  { id: 2, name: '내 인스타그램',    platform: 'instagram' as const,  subs: 120, videos: 5, status: '운영중', goal: 1000 },
  { id: 3, name: '내 네이버 블로그', platform: 'naver-blog' as const, subs: 0,   videos: 0, status: '준비중', goal: 100 },
  { id: 4, name: '내 티스토리',      platform: 'tistory' as const,    subs: 0,   videos: 0, status: '준비중', goal: 50 },
]

export const CALENDAR_ITEMS = [
  { id: 1, day: '오늘',   title: '금리 인상 분석 영상 업로드',   platform: 'youtube' as const,    status: 'scheduled', time: '오후 6시' },
  { id: 2, day: '내일',   title: '부동산 투자 블로그 포스팅',     platform: 'naver-blog' as const, status: 'scheduled', time: '오전 9시' },
  { id: 3, day: '모레',   title: '주식 투자 인스타 카드뉴스',     platform: 'instagram' as const,  status: 'scheduled', time: '오전 11시' },
  { id: 4, day: '3일 후', title: '경제 뉴스 Shorts 업로드',      platform: 'youtube' as const,    status: 'draft',     time: '오후 7시' },
  { id: 5, day: '4일 후', title: '재테크 티스토리 포스팅',        platform: 'tistory' as const,    status: 'draft',     time: '오전 10시' },
  { id: 6, day: '5일 후', title: '노후 연금 분석 영상',           platform: 'youtube' as const,    status: 'idea',      time: '미정' },
  { id: 7, day: '6일 후', title: '달러 환율 전망 릴스',           platform: 'instagram' as const,  status: 'idea',      time: '미정' },
]

export const COLLECT_JOBS = [
  { id: 1, name: 'YouTube API 수집',   platform: 'youtube' as const,    lastRun: '2시간 전',  status: 'success', count: 47, next: '4시간 후' },
  { id: 2, name: 'Instagram Scraper',  platform: 'instagram' as const,  lastRun: '5시간 전',  status: 'success', count: 23, next: '7시간 후' },
  { id: 3, name: '네이버 블로그 수집',  platform: 'naver-blog' as const, lastRun: '1일 전',   status: 'warning', count: 12, next: '수동 실행 필요' },
  { id: 4, name: '티스토리 수집',       platform: 'tistory' as const,    lastRun: '실행 안됨', status: 'idle',    count: 0,  next: '설정 필요' },
]

export const COLLECT_LOGS = [
  { time: '14:32', message: 'YouTube API: 영상 47개 수집 완료',       type: 'success' as const },
  { time: '11:15', message: 'Instagram: 포스트 23개 수집 완료',       type: 'success' as const },
  { time: '09:00', message: '네이버 블로그: Rate limit 경고 (429)',   type: 'warning' as const },
  { time: '어제',  message: 'YouTube API: vs.Avg 계산 완료 (10개)',   type: 'success' as const },
  { time: '어제',  message: '티스토리: API 키 미설정',                 type: 'error' as const },
]

export const REVENUE_DATA = [
  { platform: 'youtube' as const,    label: 'YouTube AdSense', monthly: 0, rpm: 1500, status: 'inactive', goal: 50000 },
  { platform: 'instagram' as const,  label: 'Instagram 협찬',  monthly: 0, rpm: 0,    status: 'inactive', goal: 100000 },
  { platform: 'naver-blog' as const, label: '네이버 AdPost',   monthly: 0, rpm: 800,  status: 'inactive', goal: 30000 },
  { platform: 'tistory' as const,    label: '티스토리 AdSense',monthly: 0, rpm: 1200, status: 'inactive', goal: 30000 },
]

export const MONTHLY_GOAL = 500000
