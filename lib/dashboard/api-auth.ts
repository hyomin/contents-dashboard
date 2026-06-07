import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth/session'
import { isWeakDashboardSecret } from '@/lib/dashboard/env-security'

// 상수-시간 문자열 비교 — 길이 차이도 timing oracle이 되지 않도록 max(len) 기준으로 루프
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  const len = Math.max(aBytes.length, bBytes.length)
  const aPadded = new Uint8Array(len)
  const bPadded = new Uint8Array(len)
  aPadded.set(aBytes)
  bPadded.set(bBytes)
  // 길이가 다르면 diff가 0이 아님을 반드시 보장
  let diff = aBytes.length === bBytes.length ? 0 : 1
  for (let i = 0; i < len; i++) diff |= aPadded[i] ^ bPadded[i]
  return diff === 0
}

/** 서버 라우트 → 대시보드 API 내부 fetch 시 인증 헤더 (script-guide·cron 등) */
export function headersForDashboardInternalFetch(
  incoming?: NextRequest,
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = getUsableDashboardApiSecret()
  if (secret) {
    headers['x-dashboard-api-key'] = secret
    return headers
  }
  const cookie = incoming?.headers.get('cookie')
  if (cookie) headers.cookie = cookie
  return headers
}

export function getProvidedSecret(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  return request.headers.get('x-dashboard-api-key')?.trim() ?? null
}

function getUsableDashboardApiSecret(): string | null {
  const secret = process.env.DASHBOARD_API_SECRET?.trim()
  if (!secret) return null
  if (process.env.NODE_ENV === 'production' && isWeakDashboardSecret(secret)) return null
  return secret
}

/** n8n·서버 간 호출용 — DASHBOARD_API_SECRET 일치 여부 */
export function hasValidDashboardApiSecret(request: NextRequest): boolean {
  const secret = getUsableDashboardApiSecret()
  if (!secret) return false
  const provided = getProvidedSecret(request)
  return Boolean(provided && safeEqual(provided, secret))
}

function getUsableCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 24) return null
  if (process.env.NODE_ENV === 'production' && isWeakDashboardSecret(secret)) return null
  return secret
}

/** Vercel Cron 전용 — CRON_SECRET Bearer */
export function hasValidCronSecret(request: NextRequest): boolean {
  const secret = getUsableCronSecret()
  if (!secret) return false
  const provided = getProvidedSecret(request)
  return Boolean(provided && safeEqual(provided, secret))
}

/** Vercel 배포에서만 x-vercel-cron 헤더 신뢰 (CRON_SECRET 미설정 시 폴백) */
export function isTrustedVercelCronRequest(request: NextRequest): boolean {
  if (process.env.VERCEL !== '1') return false
  return request.headers.get('x-vercel-cron') === '1'
}

export function hasValidCronAuth(request: NextRequest): boolean {
  return (
    hasValidDashboardApiSecret(request) ||
    hasValidCronSecret(request) ||
    isTrustedVercelCronRequest(request)
  )
}

/** 라우트 핸들러 이중 방어 — null이면 통과 */
export async function denyUnlessDashboardMutationAuth(
  request: NextRequest,
): Promise<NextResponse | null> {
  return verifyDashboardApiAuth(request)
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
  const rawSecret = process.env.DASHBOARD_API_SECRET?.trim()
  const isProduction = process.env.NODE_ENV === 'production'

  if (!rawSecret) {
    if (isProduction) {
      return NextResponse.json(
        { error: 'DASHBOARD_API_SECRET이 설정되지 않았습니다. 배포 환경 변수를 확인하세요.' },
        { status: 503 },
      )
    }
    return null
  }

  if (isProduction && isWeakDashboardSecret(rawSecret)) {
    return NextResponse.json(
      {
        error:
          'DASHBOARD_API_SECRET이 예시 문구이거나 너무 짧습니다. npm run env:secret 로 새 값을 생성해 배포 환경 변수를 교체하세요.',
      },
      { status: 503 },
    )
  }

  const secret = rawSecret

  const provided = getProvidedSecret(request)
  if (provided && safeEqual(provided, secret)) return null

  if (await getSessionFromRequest(request)) return null

  if (!isProduction && isSameOriginBrowserRequest(request)) return null

  return NextResponse.json(
    { error: '인증이 필요합니다. Authorization: Bearer 또는 x-dashboard-api-key 헤더를 사용하세요.' },
    { status: 401 },
  )
}
