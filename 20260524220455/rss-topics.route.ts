import { NextRequest, NextResponse } from 'next/server'
import { getRssTopicCandidates, runRssTopicCollect } from '@/lib/data/rss-topic-collect'
import { parseJsonBody } from '@/lib/utils/request'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 30)
  const topics = await getRssTopicCandidates(limit)
  return NextResponse.json({ topics, count: topics.length })
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request)

  const result = await runRssTopicCollect({
    targetAudience: typeof body.targetAudience === 'string' ? body.targetAudience : '시니어',
    maxTopics: body.maxTopics != null ? Number(body.maxTopics) : 5,
    persistCollected: body.persistCollected !== false,
    source: typeof body.source === 'string' ? body.source : 'dashboard',
    useAi: body.useAi !== false,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
