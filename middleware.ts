import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardApiAuth } from '@/lib/api-auth'
import { getSessionFromRequest } from '@/lib/auth/session'

const MUTATION_PREFIXES = [
  '/api/dashboard/collect',
  '/api/dashboard/collect-all',
  '/api/dashboard/collect-platform',
  '/api/n8n/invoke',
  '/api/n8n/lv1-services',
  '/api/topic-suggest',
  '/api/dashboard/benchmarks',
  '/api/dashboard/benchmark-categories',
  '/api/dashboard/channels',
  '/api/dashboard/channel-flags',
  '/api/dashboard/calendar-items',
  '/api/dashboard/repurpose-items',
  '/api/dashboard/deploy-tasks',
  '/api/dashboard/workspace-seed',
]

const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/logout']

function needsMutationAuth(pathname: string): boolean {
  return MUTATION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

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

  if (isProtectedApi(pathname)) {
    if (!hasSession) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
  }

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    if (process.env.NODE_ENV === 'production' && pathname === '/api/test-supabase') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
    }
    return NextResponse.next()
  }

  if (!needsMutationAuth(pathname)) return NextResponse.next()

  const denied = await verifyDashboardApiAuth(request)
  if (denied) return denied

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/login', '/api/:path*'],
}
