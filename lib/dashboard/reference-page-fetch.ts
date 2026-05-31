const MAX_EXCERPT = 6000

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

export function extractTitleFromHtml(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeBasicEntities(og[1].trim())
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (title?.[1]) return decodeBasicEntities(title[1].trim())
  return ''
}

export function extractSiteNameFromHtml(html: string, url: string): string {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeBasicEntities(og[1].trim())
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const base = host.split('.')[0]
    return base.charAt(0).toUpperCase() + base.slice(1)
  } catch {
    return 'Web'
  }
}

export function htmlToPlainText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  text = decodeBasicEntities(text)
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return text.slice(0, MAX_EXCERPT)
}

export function isAllowedReferenceUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function fetchReferencePage(url: string): Promise<{
  url: string
  title: string
  siteName: string
  excerpt: string
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; DashboardReferenceBot/1.0; +https://localhost)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error('HTML 페이지만 지원합니다')
  }

  const html = await res.text()
  const title = extractTitleFromHtml(html) || url
  const siteName = extractSiteNameFromHtml(html, url)
  const excerpt = htmlToPlainText(html)

  if (excerpt.length < 80) {
    throw new Error('본문을 충분히 추출하지 못했습니다')
  }

  return { url, title, siteName, excerpt }
}
