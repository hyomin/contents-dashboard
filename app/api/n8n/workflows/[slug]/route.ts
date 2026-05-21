import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

/** repo docs/n8n 파일명만 허용 (path traversal 방지) */
const SLUG_TO_FILE: Record<string, string> = {
  youtube: 'N8N_YOUTUBE_COLLECT.json',
  outlier: 'N8N_OUTLIER_TAGGING.json',
  rss: 'N8N_RSS_TOPIC_COLLECT.json',
  'topic-suggest': 'N8N_TOPIC_SUGGEST.json',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const filename = SLUG_TO_FILE[slug]
  if (!filename) {
    return NextResponse.json({ error: 'Unknown workflow' }, { status: 404 })
  }

  const filePath = path.join(process.cwd(), 'docs', 'n8n', 'workflows', filename)
  try {
    const raw = await readFile(filePath, 'utf8')
    JSON.parse(raw) // 유효한 JSON인지 검증
    return new NextResponse(raw, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Workflow file not found' }, { status: 404 })
  }
}
