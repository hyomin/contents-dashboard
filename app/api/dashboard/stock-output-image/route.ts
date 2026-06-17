import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'

/** stock/<YYYY-MM-DD>/<daily|research>/<chart|slide>/{이름}-{1~4}.png 형식만 허용 (경로 탈출 방지) */
const PATH_PATTERN = /^stock\/\d{4}-\d{2}-\d{2}\/(daily|research)\/(chart|slide)\/[^/\\]+\.png$/

/** 주식 리포트 차트/슬라이드 PNG 서빙 — HTML 변환(클립보드 복사)용 원본 이미지 제공 */
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

  const buffer = readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  })
}
