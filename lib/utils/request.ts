import type { NextRequest } from 'next/server'

/**
 * NextRequest의 JSON body를 안전하게 파싱합니다.
 * - 파싱 실패 시 빈 객체 반환
 * - 배열 / 비객체 타입이면 빈 객체 반환
 */
export async function parseJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const raw = await request.json()
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>
    }
  } catch {
    /* 파싱 실패 → 빈 객체 반환 */
  }
  return {}
}
