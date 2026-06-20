import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'

/** 허용 경로:
 *  - stock/<YYYY-MM-DD>/<daily|research>/<chart|slide>/{이름}.png  (차트/슬라이드)
 *  - stock/thumbnails/{historyId}.{png|jpg|jpeg|webp}              (사용자 업로드 썸네일)
 */
const PATH_PATTERN = /^stock\/(?:\d{4}-\d{2}-\d{2}\/(daily|research)\/(chart|slide)\/[^/\\]+\.png|thumbnails\/[^/\\]+\.(png|jpe?g|webp))$/

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/** 주식 리포트 차트/슬라이드 PNG 서빙 및 커스텀 썸네일 서빙 */
export async function GET(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const path = req.nextUrl.searchParams.get('path') ?? ''
  if (!PATH_PATTERN.test(path)) {
    return NextResponse.json({ error: '잘못된 경로입니다.' }, { status: 400 })
  }

  const filePath = resolve(process.cwd(), path)
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }

  const ext = path.split('.').pop()?.toLowerCase() ?? 'png'
  const contentType = MIME_MAP[ext] ?? 'image/png'

  const buffer = readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
  })
}
