/** 네이버 블로그 채널 ID(blogId) 정규화 */

export function parseNaverBlogId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const urlMatch = trimmed.match(/blog\.naver\.com\/([^/?#]+)/i)
  if (urlMatch?.[1]) return urlMatch[1]

  const mobileMatch = trimmed.match(/m\.blog\.naver\.com\/([^/?#]+)/i)
  if (mobileMatch?.[1]) return mobileMatch[1]

  const id = trimmed.replace(/^@/, '').split('/')[0]?.trim()
  return id || null
}

export function blogIdFromBloggerLink(bloggerlink: string): string | null {
  const m = bloggerlink.match(/blog\.naver\.com\/([^/?#\s]+)/i)
  return m?.[1] ?? null
}

export function postIdFromLink(link: string): string | null {
  const m = link.match(/blog\.naver\.com\/[^/]+\/(\d+)/i)
  return m?.[1] ?? null
}
