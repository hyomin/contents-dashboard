import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const webhookUrl = process.env.N8N_WEBHOOK_URL

  // n8n webhook URL이 설정되지 않은 경우 더미 응답 반환
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'N8N_WEBHOOK_URL not configured', mode: 'dummy' },
      { status: 503 }
    )
  }

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: body.categoryId,
        category: body.category,
        platform: body.platform,
        urls: body.urls,
        // n8n이 LLM에 전달할 메타 정보
        promptVersion: '1.0',
        requestedAt: new Date().toISOString(),
      }),
    })

    if (!n8nRes.ok) {
      throw new Error(`n8n responded with ${n8nRes.status}`)
    }

    const data = await n8nRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[topic-suggest] n8n error:', err)
    return NextResponse.json(
      { error: 'n8n webhook call failed', detail: String(err) },
      { status: 502 }
    )
  }
}
