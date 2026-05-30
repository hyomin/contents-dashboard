/** 수집·API 호출 시 과금/할당량이 발생하는 서비스 표시용 */

export type BillingTier = 'free' | 'paid'

export const WEBHOOK_BILLING: Record<string, BillingTier> = {
  N8N_WEBHOOK_YOUTUBE_COLLECT: 'paid',
  N8N_WEBHOOK_OUTLIER_TAG: 'free',
  N8N_WEBHOOK_RSS_TOPICS: 'paid',
  N8N_WEBHOOK_NAVER_BLOG_VIEWS: 'paid',
  N8N_WEBHOOK_NAVER_BLOG_COLLECT: 'paid',
  N8N_WEBHOOK_TISTORY_COLLECT: 'free',
  N8N_WEBHOOK_LONGFORM_SCRIPT: 'paid',
  N8N_WEBHOOK_TOPIC_SUGGEST: 'paid',
}

export const API_SERVICE_BILLING: Record<string, BillingTier> = {
  SUPABASE: 'free',
  YOUTUBE_API_KEY: 'paid',
  NAVER_API: 'paid',
  GEMINI_API_KEY: 'paid',
  NOTION_API_KEY: 'free',
  DASHBOARD_AUTH: 'free',
}

export const WEBHOOK_BILLING_NOTE: Record<string, string> = {
  N8N_WEBHOOK_YOUTUBE_COLLECT: 'YouTube Data API 할당량',
  N8N_WEBHOOK_RSS_TOPICS: 'Gemini AI 토큰',
  N8N_WEBHOOK_NAVER_BLOG_VIEWS: 'Naver API·크롤링',
  N8N_WEBHOOK_NAVER_BLOG_COLLECT: 'Naver Open API',
  N8N_WEBHOOK_LONGFORM_SCRIPT: 'Gemini AI 토큰',
  N8N_WEBHOOK_TOPIC_SUGGEST: 'Gemini AI 토큰',
}

export const API_BILLING_NOTE: Record<string, string> = {
  YOUTUBE_API_KEY: '수집·검색마다 할당량 차감',
  NAVER_API: '일일 호출 한도',
  GEMINI_API_KEY: '요청마다 토큰·일일 한도',
}
