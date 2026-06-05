import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { fetchReferencePage, isAllowedReferenceUrl } from '@/lib/dashboard/reference-page-fetch'

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const body = (await req.json()) as { url?: string }
  const url = body.url?.trim() ?? ''

  if (!isAllowedReferenceUrl(url)) {
    return NextResponse.json({ error: 'http 또는 https URL을 입력해 주세요.' }, { status: 400 })
  }

  try {
    const data = await fetchReferencePage(url)
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '페이지를 가져오지 못했습니다'
    console.error('[reference-page-fetch]', url, msg)
    return NextResponse.json(
      { error: `페이지 수집 실패: ${msg}. 로그인·차단 페이지는 지원되지 않을 수 있습니다.` },
      { status: 502 },
    )
  }
}
