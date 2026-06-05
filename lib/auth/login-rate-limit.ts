import type { NextRequest } from 'next/server'

interface AttemptRecord {
  failures: number
  windowStart: number
  lockedUntil?: number
}

const store = new Map<string, AttemptRecord>()

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

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now()
  const rec = store.get(key)

  if (!rec) return { allowed: true }

  if (rec.lockedUntil && now < rec.lockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) }
  }

  if (now - rec.windowStart > WINDOW_MS) {
    store.delete(key)
    return { allowed: true }
  }

  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCK_MS
    store.set(key, rec)
    return { allowed: false, retryAfterSec: Math.ceil(LOCK_MS / 1000) }
  }

  return { allowed: true }
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const rec = store.get(key)

  if (!rec || now - rec.windowStart > WINDOW_MS) {
    store.set(key, { failures: 1, windowStart: now })
    return
  }

  rec.failures += 1
  if (rec.failures >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCK_MS
  }
  store.set(key, rec)
}

export function clearLoginAttempts(key: string): void {
  store.delete(key)
}
