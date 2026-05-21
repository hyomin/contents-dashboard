import { NextRequest, NextResponse } from 'next/server'
import {
  applySessionCookie,
  getSessionFromRequest,
  touchSessionPayload,
} from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, lastActivity: Date.now() })
  const updated = await applySessionCookie(response, touchSessionPayload(session))
  if (!updated) {
    return NextResponse.json({ error: '세션 설정 오류' }, { status: 503 })
  }
  return updated
}
