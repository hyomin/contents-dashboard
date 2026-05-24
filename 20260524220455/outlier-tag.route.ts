import { NextRequest, NextResponse } from 'next/server'
import { getTaggedOutlierVideos, runOutlierTagging } from '@/lib/data/outlier-tagging'
import { parseJsonBody } from '@/lib/utils/request'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 50)
  const tagged = await getTaggedOutlierVideos(limit)
  return NextResponse.json({ tagged, count: tagged.length })
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request)

  const minVsAvg = body.minVsAvg != null ? Number(body.minVsAvg) : 3
  const persistTagged = body.persistTagged !== false

  const result = await runOutlierTagging({
    minVsAvg: Number.isFinite(minVsAvg) ? minVsAvg : 3,
    persistTagged,
    source: typeof body.source === 'string' ? body.source : 'dashboard',
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
