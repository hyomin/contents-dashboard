/** 자동 수집·vs.Avg 분석 파이프라인이 연결된 플랫폼 */
export const PLATFORMS_WITH_COLLECTION = ['youtube', 'naver-blog', 'tistory'] as const

/**
 * 발행 확장 전용 — 레퍼런스 수집·분석 없음.
 * 숏폼: YouTube Shorts 참고 → TikTok/Instagram. 블로그: 네이버 초안 → Google Blogger 미러.
 */
export const PLATFORMS_PUBLISH_EXPANSION = ['tiktok', 'instagram', 'blogger'] as const

export function isCollectionEnabled(platform: string): boolean {
  return (PLATFORMS_WITH_COLLECTION as readonly string[]).includes(platform)
}

export function isPlatformPublishExpansion(platform: string): boolean {
  return (PLATFORMS_PUBLISH_EXPANSION as readonly string[]).includes(platform)
}

/** @deprecated 발행 확장 플랫폼 — isPlatformPublishExpansion 사용 */
export function isPlatformDummyPreview(platform: string): boolean {
  return platform === 'tiktok'
}

/** @deprecated 발행 확장 플랫폼 — isPlatformPublishExpansion 사용 */
export function isPlatformComingSoon(platform: string): boolean {
  return platform === 'instagram'
}
