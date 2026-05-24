import { NextRequest, NextResponse } from 'next/server'
import { invokeN8nWebhook } from '@/lib/n8n/invoke-webhook'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const webhookUrl = process.env.N8N_WEBHOOK_URL

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'N8N_WEBHOOK_URL not configured', mode: 'dummy' },
      { status: 503 },
    )
  }

  try {
    const result = await invokeN8nWebhook(webhookUrl, {
      categoryId: body.categoryId,
      category: body.category,
      platform: body.platform,
      urls: body.urls,
      promptVersion: '1.0',
      requestedAt: new Date().toISOString(),
    })

    if (!result.ok) {
      throw new Error(`n8n responded with ${result.status}`)
    }

    return NextResponse.json(result.body)
  } catch (err) {
    console.error('[topic-suggest] n8n error:', err)
    return NextResponse.json(
      { error: 'n8n webhook call failed', detail: String(err) },
      { status: 502 },
    )
  }
}
