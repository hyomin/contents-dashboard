import type { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, SESSION_IDLE_MS } from '@/lib/auth/constants'

const TOKEN_SEP = '.'
const encoder = new TextEncoder()

export interface SessionPayload {
  sub: string
  issuedAt: number
  lastActivity: number
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodePayload(body: string): SessionPayload | null {
  try {
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (
      typeof raw.sub !== 'string' ||
      typeof raw.issuedAt !== 'number' ||
      typeof raw.lastActivity !== 'number'
    ) {
      return null
    }
    return raw
  } catch {
    return null
  }
}

async function hmacBase64Url(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Buffer.from(sig).toString('base64url')
}

function safeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function getSessionSecret(): string | null {
  const secret =
    process.env.DASHBOARD_SESSION_SECRET?.trim() ||
    process.env.DASHBOARD_API_SECRET?.trim()
  return secret || null
}

export async function signSessionToken(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const body = encodePayload(payload)
  const sig = await hmacBase64Url(body, secret)
  return `${body}${TOKEN_SEP}${sig}`
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const sep = token.lastIndexOf(TOKEN_SEP)
  if (sep <= 0) return null

  const body = token.slice(0, sep)
  const sig = token.slice(sep + 1)
  const expected = await hmacBase64Url(body, secret)

  if (!safeEqualString(sig, expected)) return null

  const payload = decodePayload(body)
  if (!payload) return null

  if (Date.now() - payload.lastActivity > SESSION_IDLE_MS) return null

  return payload
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const secret = getSessionSecret()
  const token = getSessionTokenFromRequest(request)
  if (!secret || !token) return null
  return verifySessionToken(token, secret)
}

export function createSessionPayload(userId: string): SessionPayload {
  const now = Date.now()
  return { sub: userId, issuedAt: now, lastActivity: now }
}

export function touchSessionPayload(payload: SessionPayload): SessionPayload {
  return { ...payload, lastActivity: Date.now() }
}

export function buildSessionCookie(token: string): {
  name: string
  value: string
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
} {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  }
}

export async function applySessionCookie(
  response: NextResponse,
  payload: SessionPayload,
): Promise<NextResponse | null> {
  const secret = getSessionSecret()
  if (!secret) return null

  const token = await signSessionToken(payload, secret)
  response.cookies.set(buildSessionCookie(token))
  return response
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export function isSessionConfigured(): boolean {
  return Boolean(getSessionSecret())
}
