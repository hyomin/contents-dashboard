/**
 * Notion API 클라이언트 (server-side only)
 * 환경변수: NOTION_API_KEY
 */

const NOTION_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

export async function notionPost<T = unknown>(
  token: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Notion API 오류 [${res.status}] ${json?.message ?? path}`)
  }
  return json as T
}

export async function notionPatch<T = unknown>(
  token: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Notion API 오류 [${res.status}] ${json?.message ?? path}`)
  }
  return json as T
}

export async function notionGet<T = unknown>(token: string, path: string): Promise<T> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    method: 'GET',
    headers: headers(token),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Notion API 오류 [${res.status}] ${json?.message ?? path}`)
  }
  return json as T
}

// ─── Block builders ───────────────────────────────────────────────

export function headingBlock(level: 1 | 2 | 3, text: string) {
  const type = `heading_${level}` as const
  return {
    type,
    [type]: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  }
}

export function bulletBlock(
  text: string,
  url?: string | null,
  suffix?: string,
) {
  const richText: unknown[] = []
  if (url) {
    richText.push({ type: 'text', text: { content: text, link: { url } } })
    if (suffix) richText.push({ type: 'text', text: { content: `  ${suffix}` } })
  } else {
    richText.push({ type: 'text', text: { content: text + (suffix ? `  ${suffix}` : '') } })
  }
  return {
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: richText },
  }
}

export function paragraphBlock(text: string) {
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  }
}

export function dividerBlock() {
  return { type: 'divider', divider: {} }
}
