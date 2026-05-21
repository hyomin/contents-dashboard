import { NextRequest, NextResponse } from 'next/server'
import { verifyLoginCredentials } from '@/lib/auth/credentials'
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

  const verified = await verifyLoginCredentials(loginId, password)
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 })
  }

  const payload = createSessionPayload(loginId)
  const token = await signSessionToken(payload, secret)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(buildSessionCookie(token))
  return response
}
