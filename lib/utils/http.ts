/** 네이버·티스토리 스크래핑용 공통 User-Agent */
export const NAVER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

/**
 * URL에 POST 요청을 보내고 텍스트를 받아 JSON 파싱을 시도합니다.
 * JSON이 아닌 경우 원본 텍스트를 그대로 반환합니다.
 */
export async function postAndParseResponse(
  url: string,
  data: unknown,
  options?: { signal?: AbortSignal },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
    signal: options?.signal,
  })
  const text = await res.text()
  let body: unknown = text
  try {
    body = JSON.parse(text) as unknown
  } catch {
    /* raw text */
  }
  return { ok: res.ok, status: res.status, body }
}
