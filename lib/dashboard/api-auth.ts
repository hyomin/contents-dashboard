import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth/session'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export function getProvidedSecret(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return request.headers.get('x-dashboard-api-key')?.trim() ?? null
}

/** n8n·서버 간 호출용 — DASHBOARD_API_SECRET 일치 여부 */
export function hasValidDashboardApiSecret(request: NextRequest): boolean {
  const secret = process.env.DASHBOARD_API_SECRET?.trim()
  if (!secret) return false
  const provided = getProvidedSecret(request)
  return Boolean(provided && safeEqual(provided, secret))
}

/** 대시보드 UI(fetch)에서 오는 동일 출처 요청 — API 키 없이 허용 (비밀키는 브라우저에 넣지 않음) */
export function isSameOriginBrowserRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')
  if (secFetchSite === 'same-origin') return true

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * 민감 API(수집·n8n·쓰기) 인증.
 * - 프로덕션: DASHBOARD_API_SECRET 필수. Bearer/x-dashboard-api-key 또는 동일 출처 UI 요청 허용.
 * - 개발: 시크릿 미설정 시 통과(기존 로컬 DX). 설정 시 프로덕션과 동일 규칙.
 */
export async function verifyDashboardApiAuth(
  request: NextRequest,
): Promise<NextResponse | null> {
  const secret = process.env.DASHBOARD_API_SECRET?.trim()
  const isProduction = process.env.NODE_ENV === 'production'

  if (!secret) {
    if (isProduction) {
      return NextResponse.json(
        { error: 'DASHBOARD_API_SECRET이 설정되지 않았습니다. 배포 환경 변수를 확인하세요.' },
        { status: 503 },
      )
    }
    return null
  }

  const provided = getProvidedSecret(request)
  if (provided && safeEqual(provided, secret)) return null

  if (await getSessionFromRequest(request)) return null

  if (!isProduction && isSameOriginBrowserRequest(request)) return null

  return NextResponse.json(
    { error: '인증이 필요합니다. Authorization: Bearer 또는 x-dashboard-api-key 헤더를 사용하세요.' },
    { status: 401 },
  )
}
