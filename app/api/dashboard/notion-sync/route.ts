import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardApiAuth } from '@/lib/dashboard/api-auth'
import { recordWorkflowToNotion } from '@/lib/notion/notion-log'

/**
 * POST /api/dashboard/notion-sync
 *
 * n8n 워크플로 실행 결과를 Notion에 기록합니다.
 * 1depth: yyyy-MM-dd  /  2depth: 플랫폼·워크플로 서브 페이지
 *
 * Body:
 *   workflowKey  string  (예: 'youtube-collect')
 *   platform?    string  (예: 'youtube' | 'naver-blog' | 'tistory')
 *   date?        string  yyyy-MM-dd KST (미지정 시 오늘)
 *   summary?     { ok, succeeded, failed, total, message }
 */
export async function POST(request: NextRequest) {
  const denied = await verifyDashboardApiAuth(request)
  if (denied) return denied

  let body: {
    workflowKey?: string
    platform?: string
    date?: string
    summary?: {
      ok?: boolean
      succeeded?: number
      failed?: number
      total?: number
      message?: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 })
  }

  if (!body.workflowKey) {
    return NextResponse.json({ error: 'workflowKey 필수' }, { status: 400 })
  }

  const notionKey = process.env.NOTION_API_KEY
  const parentPageId = process.env.NOTION_LOG_PARENT_PAGE_ID

  if (!notionKey || !parentPageId) {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: 'NOTION_API_KEY 또는 NOTION_LOG_PARENT_PAGE_ID 미설정. .env.local 확인 후 서버 재시작.',
      },
      { status: 200 },
    )
  }

  try {
    const result = await recordWorkflowToNotion({
      workflowKey: body.workflowKey,
      platform: body.platform,
      date: body.date,
      summary: body.summary,
    })

    return NextResponse.json({
      ok: result.ok,
      datePageId: result.datePageId,
      subPageId: result.subPageId,
      subPageUrl: result.subPageUrl,
      itemCount: result.itemCount,
      error: result.error,
    })
  } catch (err) {
    console.error('[notion-sync] 오류:', err)
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    )
  }
}

/** GET: 설정 상태 확인 */
export async function GET() {
  const hasKey = Boolean(process.env.NOTION_API_KEY)
  const hasParent = Boolean(process.env.NOTION_LOG_PARENT_PAGE_ID)
  return NextResponse.json({
    configured: hasKey && hasParent,
    hasApiKey: hasKey,
    hasParentPageId: hasParent,
  })
}
