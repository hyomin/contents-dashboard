import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/data/supabase-admin'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip')?.trim() ?? 'unknown'
}

export function buildLoginRateLimitKey(request: NextRequest, loginId: string): string {
  return `${getClientIp(request)}:${loginId.trim().toLowerCase()}`
}

export async function checkLoginRateLimit(
  key: string,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  try {
    const { data } = await supabaseAdmin
      .from('login_rate_limits')
      .select('failures, window_start, locked_until')
      .eq('key', key)
      .maybeSingle()

    if (!data) return { allowed: true }

    const now = Date.now()

    if (data.locked_until && new Date(data.locked_until).getTime() > now) {
      const retryAfterSec = Math.ceil((new Date(data.locked_until).getTime() - now) / 1000)
      return { allowed: false, retryAfterSec }
    }

    if (now - new Date(data.window_start).getTime() > WINDOW_MS) {
      await supabaseAdmin.from('login_rate_limits').delete().eq('key', key)
      return { allowed: true }
    }

    if (data.failures >= MAX_FAILURES) {
      const lockedUntil = new Date(now + LOCK_MS).toISOString()
      await supabaseAdmin
        .from('login_rate_limits')
        .update({ locked_until: lockedUntil, updated_at: new Date().toISOString() })
        .eq('key', key)
      return { allowed: false, retryAfterSec: Math.ceil(LOCK_MS / 1000) }
    }

    return { allowed: true }
  } catch {
    // DB 오류 시 fail-open: 정상 사용자 차단보다 허용 우선
    return { allowed: true }
  }
}

export async function recordLoginFailure(key: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    const nowMs = Date.now()

    const { data } = await supabaseAdmin
      .from('login_rate_limits')
      .select('failures, window_start')
      .eq('key', key)
      .maybeSingle()

    if (!data || nowMs - new Date(data.window_start).getTime() > WINDOW_MS) {
      await supabaseAdmin
        .from('login_rate_limits')
        .upsert(
          { key, failures: 1, window_start: now, locked_until: null, updated_at: now },
          { onConflict: 'key' },
        )
      return
    }

    const newFailures = data.failures + 1
    const lockedUntil =
      newFailures >= MAX_FAILURES ? new Date(nowMs + LOCK_MS).toISOString() : null
    await supabaseAdmin
      .from('login_rate_limits')
      .update({ failures: newFailures, locked_until: lockedUntil, updated_at: now })
      .eq('key', key)
  } catch {
    // 실패 기록 오류는 무시 (로그인 흐름 차단 방지)
  }
}

export async function clearLoginAttempts(key: string): Promise<void> {
  try {
    await supabaseAdmin.from('login_rate_limits').delete().eq('key', key)
  } catch {
    // 무시
  }
}
