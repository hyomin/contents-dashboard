/**
 * POST·PUT·PATCH·DELETE 보호 대상 API 경로 (단일 소스).
 * middleware와 문서가 이 목록을 기준으로 동작합니다.
 * /api/cron/* · /api/auth/login|logout|heartbeat 는 별도 규칙.
 */
export const MUTATION_API_PREFIXES = [
  '/api/dashboard/collect',
  '/api/dashboard/collect-all',
  '/api/dashboard/collect-platform',
  '/api/dashboard/collect-pending',
  '/api/dashboard/naver-blog-views',
  '/api/dashboard/notion-sync',
  '/api/dashboard/rss-topics',
  '/api/dashboard/outlier-tag',
  '/api/n8n/invoke',
  '/api/n8n/lv1-services',
  '/api/topic-suggest',
  '/api/dashboard/benchmarks',
  '/api/dashboard/benchmark-categories',
  '/api/dashboard/channels',
  '/api/dashboard/channel-flags',
  '/api/dashboard/channel-categories',
  '/api/dashboard/calendar-items',
  '/api/dashboard/repurpose-items',
  '/api/dashboard/deploy-tasks',
  '/api/dashboard/workspace-seed',
  '/api/dashboard/generation-history',
  '/api/dashboard/topic-guide-history',
  '/api/dashboard/content-generate',
  '/api/dashboard/content-polish',
  '/api/dashboard/script-guide',
  '/api/dashboard/topic-keyword-guide',
  '/api/dashboard/reference-suggest-sites',
  '/api/dashboard/reference-page-fetch',
  '/api/dashboard/settings',
  '/api/dashboard/saved-shorts',
  '/api/dashboard/videos/backfill-format',
] as const

/** Gemini·외부 fetch 등 비용·민감 라우트 — 라우트 핸들러에서 이중 검증 */
export const SENSITIVE_MUTATION_PREFIXES = [
  '/api/dashboard/content-generate',
  '/api/dashboard/content-polish',
  '/api/dashboard/script-guide',
  '/api/dashboard/topic-keyword-guide',
  '/api/dashboard/reference-suggest-sites',
  '/api/dashboard/reference-page-fetch',
  '/api/topic-suggest',
] as const

export function matchesApiPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function needsMutationApiAuth(pathname: string): boolean {
  return matchesApiPrefix(pathname, MUTATION_API_PREFIXES)
}

export function isSensitiveMutationRoute(pathname: string): boolean {
  return matchesApiPrefix(pathname, SENSITIVE_MUTATION_PREFIXES)
}

export function isCronApi(pathname: string): boolean {
  return pathname.startsWith('/api/cron/')
}
