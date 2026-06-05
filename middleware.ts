import { NextRequest, NextResponse } from 'next/server'
import {
  hasValidCronAuth,
  hasValidDashboardApiSecret,
  verifyDashboardApiAuth,
} from '@/lib/dashboard/api-auth'
import { getSessionFromRequest } from '@/lib/auth/session'
import { isCronApi, needsMutationApiAuth } from '@/lib/dashboard/mutation-routes'

const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/logout']

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isProtectedPage(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/dashboard')
}

function isProtectedApi(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false
  if (isPublicApi(pathname)) return false
  if (pathname.startsWith('/api/auth/')) return false
  return true
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  const { pathname, search } = request.nextUrl
  if (pathname !== '/' && pathname !== '/login') {
    loginUrl.searchParams.set('from', `${pathname}${search}`)
  }
  return NextResponse.redirect(loginUrl)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const session = await getSessionFromRequest(request)
  const hasSession = Boolean(session)

  if (pathname === '/login') {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (isProtectedPage(pathname)) {
    if (!hasSession) return redirectToLogin(request)
    return NextResponse.next()
  }

  const isMutation =
    method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && needsMutationApiAuth(pathname)
  const hasMachineAuth = hasValidDashboardApiSecret(request)

  if (isCronApi(pathname)) {
    const isProduction = process.env.NODE_ENV === 'production'
    const hasCronSecrets = Boolean(
      process.env.DASHBOARD_API_SECRET?.trim() || process.env.CRON_SECRET?.trim(),
    )
    const cronAuthRequired = isProduction || (method !== 'GET' && hasCronSecrets)
    if (cronAuthRequired && !hasValidCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (isProtectedApi(pathname)) {
    if (!hasSession && !hasMachineAuth) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
  }

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    if (process.env.NODE_ENV === 'production' && pathname === '/api/test-supabase') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
    }
    return NextResponse.next()
  }

  if (!needsMutationApiAuth(pathname)) return NextResponse.next()

  // Edge 미들웨어에서는 DASHBOARD_API_SECRET 검증 불가 → 라우트(Node)에서 재검증
  if (hasMachineAuth) return NextResponse.next()

  const denied = await verifyDashboardApiAuth(request)
  if (denied) return denied

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/login', '/api/:path*'],
}
