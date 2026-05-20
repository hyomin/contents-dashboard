import { NextRequest, NextResponse } from 'next/server'

function isAllowedWebhookUrl(url: string): boolean {
  const prefix = process.env.N8N_WEBHOOK_ALLOW_PREFIX?.trim()
  if (prefix && url.startsWith(prefix)) return true

  const defaultWebhook = process.env.N8N_WEBHOOK_URL?.trim()
  if (defaultWebhook) {
    if (url === defaultWebhook) return true
    const lastSlash = defaultWebhook.lastIndexOf('/')
    const base = lastSlash > 0 ? defaultWebhook.slice(0, lastSlash + 1) : `${defaultWebhook}/`
    if (url.startsWith(base)) return true
  }

  try {
    const u = new URL(url)
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      (u.port === '5678' || u.href.includes(':5678/'))
    )
      return true
  } catch {
    return false
  }
  return false
}

/**
 * n8n 웹훅을 서버에서 호출해 CORS를 피하고, 허용된 URL만 전달 (SSRF 완화).
 * body: { url?: string, data?: unknown } — url 생략 시 N8N_WEBHOOK_URL
 */
export async function POST(req: NextRequest) {
  let body: { url?: string; data?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetUrl = (body.url?.trim() || process.env.N8N_WEBHOOK_URL?.trim()) ?? ''
  if (!targetUrl) {
    return NextResponse.json(
      { error: '웹훅 URL이 없습니다. 본문에 url을 넣거나 .env에 N8N_WEBHOOK_URL을 설정하세요.' },
      { status: 400 },
    )
  }

  if (!isAllowedWebhookUrl(targetUrl)) {
    return NextResponse.json(
      {
        error:
          '허용되지 않은 웹훅 URL입니다. N8N_WEBHOOK_URL·N8N_WEBHOOK_ALLOW_PREFIX 또는 localhost:5678만 사용 가능합니다.',
      },
      { status: 403 },
    )
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.data ?? {}),
    })
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      /* raw text */
    }
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: parsed,
    })
  } catch (err) {
    console.error('[n8n/invoke]', err)
    return NextResponse.json(
      { error: '웹훅 호출 실패', detail: String(err) },
      { status: 502 },
    )
  }
}
