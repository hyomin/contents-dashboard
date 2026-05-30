const STORAGE_KEY = 'guide-publish-topic-v1'

export function loadPublishTopic(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function savePublishTopic(topic: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, topic)
  } catch {}
}

/** 쉼표·줄바꿈·중점(·) 구분 → 키워드 배열 */
export function parsePublishKeywords(text: string): string[] {
  return text
    .split(/[,，\n·|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 8)
}
