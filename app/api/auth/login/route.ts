import { NextRequest, NextResponse } from 'next/server'
import { verifyLoginCredentials } from '@/lib/auth/credentials'
import {
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginAttempts,
  recordLoginFailure,
} from '@/lib/auth/login-rate-limit'
import {
  createSessionPayload,
  getSessionSecret,
  signSessionToken,
  buildSessionCookie,
} from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const secret = getSessionSecret()
  if (!secret) {
    return NextResponse.json(
      {
        error:
          'DASHBOARD_SESSION_SECRET 또는 DASHBOARD_API_SECRET을 설정해야 로그인할 수 있습니다.',
      },
      { status: 503 },
    )
  }

  let body: { loginId?: string; password?: string }
  try {
    body = (await request.json()) as { loginId?: string; password?: string }
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const loginId = body.loginId?.trim() ?? ''
  const password = body.password ?? ''

  if (!loginId || !password) {
    return NextResponse.json(
      { error: '아이디와 비밀번호를 입력해 주세요.' },
      { status: 400 },
    )
  }

  const rateKey = buildLoginRateLimitKey(request, loginId)
  const rate = checkLoginRateLimit(rateKey)
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `로그인 시도가 너무 많습니다. ${rate.retryAfterSec ?? 900}초 후 다시 시도해 주세요.`,
      },
      { status: 429 },
    )
  }

  const verified = await verifyLoginCredentials(loginId, password)
  if (!verified.ok) {
    recordLoginFailure(rateKey)
    return NextResponse.json({ error: verified.error }, { status: 401 })
  }

  clearLoginAttempts(rateKey)

  const payload = createSessionPayload(loginId)
  const token = await signSessionToken(payload, secret)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(buildSessionCookie(token))
  return response
}
