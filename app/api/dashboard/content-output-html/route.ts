import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { getGenerationHistoryById } from '@/lib/data/generation-history-queries'
import { renderContentOutputHtml } from '@/lib/dashboard/content-html-render'

/** 발행 전 미리보기 — 생성 결과를 이미지 포함 standalone HTML로 렌더링 */
export async function GET(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const historyId = req.nextUrl.searchParams.get('historyId')?.trim()
  if (!historyId) {
    return new NextResponse('historyId가 필요합니다.', { status: 400 })
  }

  const item = await getGenerationHistoryById(historyId)
  if (!item) {
    return new NextResponse('히스토리를 찾을 수 없습니다.', { status: 404 })
  }
  if (!item.polished) {
    return new NextResponse('아직 정제된 콘텐츠가 없습니다. 생성을 완료한 뒤 다시 시도하세요.', { status: 404 })
  }

  const html = renderContentOutputHtml(item)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
