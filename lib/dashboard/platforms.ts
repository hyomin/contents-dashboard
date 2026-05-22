/** 자동 수집 파이프라인이 연결된 플랫폼 */
export const PLATFORMS_WITH_COLLECTION = ['youtube', 'naver-blog', 'tistory'] as const

/** 더미 데이터로 UI 미리보기 (Apify 연동 예정) */
export const PLATFORMS_DUMMY_PREVIEW = ['tiktok'] as const

/** UI만 제공 · 수집 미구현 */
export const PLATFORMS_COMING_SOON = ['instagram'] as const

export function isCollectionEnabled(platform: string): boolean {
  return (PLATFORMS_WITH_COLLECTION as readonly string[]).includes(platform)
}

export function isPlatformDummyPreview(platform: string): boolean {
  return (PLATFORMS_DUMMY_PREVIEW as readonly string[]).includes(platform)
}

export function isPlatformComingSoon(platform: string): boolean {
  return (PLATFORMS_COMING_SOON as readonly string[]).includes(platform)
}
