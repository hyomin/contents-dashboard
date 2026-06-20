import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { getGenerationHistoryById } from '@/lib/data/generation-history-queries'
import { renderContentOutputHtml, type PlatformId } from '@/lib/dashboard/content-html-render'

const VALID_PLATFORMS: PlatformId[] = ['naver-blog', 'tistory', 'blogger']

function readBase64(relativePath: string): string | undefined {
  const abs = resolve(process.cwd(), relativePath)
  if (!existsSync(abs)) return undefined
  return readFileSync(abs).toString('base64')
}

/** 발행 전 미리보기 — 생성 결과를 이미지 포함 standalone HTML로 렌더링 (?platform=naver-blog|tistory|blogger) */
export async function GET(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const historyId = req.nextUrl.searchParams.get('historyId')?.trim()
  if (!historyId) {
    return new NextResponse('historyId가 필요합니다.', { status: 400 })
  }

  const platformParam = req.nextUrl.searchParams.get('platform')?.trim() as PlatformId | null
  const platform: PlatformId = VALID_PLATFORMS.includes(platformParam as PlatformId)
    ? (platformParam as PlatformId)
    : 'naver-blog'

  const item = await getGenerationHistoryById(historyId)
  if (!item) {
    return new NextResponse('히스토리를 찾을 수 없습니다.', { status: 404 })
  }
  if (!item.polished) {
    return new NextResponse('아직 정제된 콘텐츠가 없습니다. 생성을 완료한 뒤 다시 시도하세요.', { status: 404 })
  }

  const thumbnailBase64 = readBase64('stock/background.png')
  const chartBgBase64 = readBase64('stock/backup-background.png')

  const html = renderContentOutputHtml(item, { platform, historyId, thumbnailBase64, chartBgBase64 })
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
