import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardApiAuth } from '@/lib/api-auth'
import { runNaverBlogViewsSync } from '@/lib/naver-blog-views'

export async function GET() {
  return NextResponse.json({
    platform: 'naver-blog',
    description:
      '네이버 블로그 글 조회수·좋아요·댓글 수집 후 vs.Avg 갱신. 조회수는 블로그 공개 설정에 따라 비어 있을 수 있으며, 이 경우 좋아요·댓글로 vs.Avg를 계산합니다.',
    methods: ['POST'],
    defaults: {
      onlyMissingViews: true,
      maxPosts: 80,
      useEngagementFallback: true,
    },
  })
}

export async function POST(request: NextRequest) {
  const denied = await verifyDashboardApiAuth(request)
  if (denied) return denied

  let body: Record<string, unknown> = {}
  try {
    const raw = await request.json()
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) body = raw as Record<string, unknown>
  } catch {
    body = {}
  }

  const result = await runNaverBlogViewsSync({
    channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
    onlyMissingViews: body.onlyMissingViews !== false,
    maxPosts: body.maxPosts != null ? Number(body.maxPosts) : undefined,
    delayMs: body.delayMs != null ? Number(body.delayMs) : undefined,
    useEngagementFallback: body.useEngagementFallback !== false,
    source: typeof body.source === 'string' ? body.source : 'dashboard',
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
