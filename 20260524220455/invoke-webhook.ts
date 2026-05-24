import { postAndParseResponse } from '@/lib/utils/http'

export interface WebhookResult {
  ok: boolean
  status: number
  body: unknown
}

/**
 * n8n webhook URL에 POST 요청을 보내고 결과를 반환합니다.
 * JSON 파싱을 시도하며, 실패 시 원본 텍스트를 반환합니다.
 *
 * @param url     - webhook URL (env 또는 localhost:5678/webhook/...)
 * @param data    - 전송할 페이로드
 * @param timeoutMs - 타임아웃(ms), 기본 60초
 */
export async function invokeN8nWebhook(
  url: string,
  data: unknown = {},
  timeoutMs = 60_000,
): Promise<WebhookResult> {
  return postAndParseResponse(url, data, {
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/**
 * env 키로 webhook URL을 조회하고, 없으면 localhost 기본 경로를 반환합니다.
 */
export function resolveN8nWebhookUrl(envKey: string, webhookPath: string): string {
  return process.env[envKey]?.trim() || `http://localhost:5678/webhook/${webhookPath}`
}
