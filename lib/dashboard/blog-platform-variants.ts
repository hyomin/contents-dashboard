import { BLOG_PUBLISH_PLATFORMS, type BlogPublishPlatformId } from '@/lib/dashboard/platforms'

export { BLOG_PUBLISH_PLATFORMS }
export type { BlogPublishPlatformId }

/** 플랫폼별 메타 변형 — 본문(fullContent)은 공통, 제목·메타·태그/라벨만 다름 */
export interface BlogPlatformVariant {
  title: string
  metaDescription?: string
  /** 네이버 자유 태그 · 티스토리 태그 */
  tags?: string[]
  /** 티스토리 카테고리 */
  category?: string
  /** Google Blogger 라벨 */
  labels?: string[]
}

export type BlogPlatformVariants = Partial<Record<BlogPublishPlatformId, BlogPlatformVariant>>

/** content_guideline.md «3플랫폼 동시 발행 구조» — Gemini 출력 JSON에 삽입할 스키마 블록 */
export const BLOG_PLATFORM_VARIANTS_SCHEMA = `"platformVariants": {
    "naver-blog": {"title": "원본 제목(핵심 키워드 앞 15자) — fullContent의 제목과 동일", "tags": ["자유 태그1", "태그2", "태그3"]},
    "tistory": {"title": "원본과 동일 또는 검색 스니펫용 소폭 변형", "metaDescription": "120자 이내", "category": "기존 운영 카테고리 중 추천 1개", "tags": ["롱테일 태그1", "태그2", "태그3"]},
    "blogger": {"title": "핵심 키워드 앞 40자, 이모지·특수문자 지양", "metaDescription": "140~160자, 첫 문장에 키워드 1개 + 이 글에서 얻는 것", "labels": ["라벨1", "라벨2", "라벨3"]}
  }`

function parseVariant(raw: unknown): BlogPlatformVariant | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const title = String(o.title ?? '').trim()
  if (!title) return null
  return {
    title,
    metaDescription: o.metaDescription ? String(o.metaDescription).trim() : undefined,
    tags: Array.isArray(o.tags) ? o.tags.map(String).map((t) => t.trim()).filter(Boolean) : undefined,
    category: o.category ? String(o.category).trim() : undefined,
    labels: Array.isArray(o.labels) ? o.labels.map(String).map((t) => t.trim()).filter(Boolean) : undefined,
  }
}

/** Gemini 응답 JSON(parsed)에서 platformVariants 추출 — 1개도 없으면 undefined */
export function parseBlogPlatformVariants(parsed: Record<string, unknown>): BlogPlatformVariants | undefined {
  const raw = parsed.platformVariants
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const variants: BlogPlatformVariants = {}
  for (const platform of BLOG_PUBLISH_PLATFORMS) {
    const v = parseVariant(o[platform])
    if (v) variants[platform] = v
  }
  return Object.keys(variants).length > 0 ? variants : undefined
}

/** 플랫폼별 «복사용» 텍스트 — 제목·메타·태그/라벨 + 본문 */
export function buildPlatformCopyText(
  platform: BlogPublishPlatformId,
  variant: BlogPlatformVariant | undefined,
  fallbackTitle: string,
  body: string,
): string {
  const title = variant?.title?.trim() || fallbackTitle
  const lines: string[] = [`# ${title}`]

  if (variant?.metaDescription) lines.push('', `> 메타 설명: ${variant.metaDescription}`)
  if (platform === 'tistory' && variant?.category) lines.push(`> 카테고리: ${variant.category}`)
  if ((platform === 'naver-blog' || platform === 'tistory') && variant?.tags?.length) {
    lines.push(`> 태그: ${variant.tags.map((t) => `#${t}`).join(' ')}`)
  }
  if (platform === 'blogger' && variant?.labels?.length) {
    lines.push(`> 라벨: ${variant.labels.join(', ')}`)
  }

  lines.push('', body)
  return lines.join('\n')
}
