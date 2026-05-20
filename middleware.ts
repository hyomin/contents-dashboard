import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardApiAuth } from '@/lib/api-auth'

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

function needsMutationAuth(pathname: string): boolean {
  return MUTATION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    if (process.env.NODE_ENV === 'production' && pathname === '/api/test-supabase') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
    }
    return NextResponse.next()
  }

  if (!needsMutationAuth(pathname)) return NextResponse.next()

  const denied = verifyDashboardApiAuth(request)
  if (denied) return denied

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
