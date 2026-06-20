export interface GeminiModelOption {
  id: string
  label: string
  hint: string
}

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: '기본 · 빠름 · 균형' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: '고품질 · 느림' },
]

/** 신규 API 키·계정에서 404 나는 구형 모델 — 폴백에서 제외 */
export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

export function resolveGeminiModel(input?: string | null): string {
  const id = input?.trim()
  if (id && GEMINI_MODEL_OPTIONS.some((m) => m.id === id)) return id
  return DEFAULT_GEMINI_MODEL
}

export function getGeminiModelLabel(modelId: string): string {
  return GEMINI_MODEL_OPTIONS.find((m) => m.id === modelId)?.label ?? modelId
}

export function buildGeminiGenerationConfig(
  model: string,
  opts: { temperature?: number; maxOutputTokens?: number },
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
  }
  if (model === 'gemini-2.5-flash' || model === 'gemini-2.5-pro') {
    config.thinkingConfig = { thinkingBudget: 0 }
  }
  return config
}

/** 503·429는 서버 과부하/속도제한 — 재시도 대상. 4xx 인증·권한 오류는 재시도해도 무의미. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // AbortError는 호출 측 타임아웃 — 재시도 불필요
  if (err.name === 'AbortError') return false
  return true
}

const RETRY_DELAYS_MS = [1_000, 2_000] as const // 최초 실패 후 1s → 2s 대기, 총 2회 재시도

export async function callGeminiGenerateContent(
  apiKey: string,
  model: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number; timeoutMs?: number; fileUri?: string },
): Promise<
  | { ok: true; text: string; finishReason?: string; truncated: boolean; blockReason?: string }
  | { ok: false; status: number; error: string }
> {
  const resolved = resolveGeminiModel(model)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolved}:generateContent`

  /** YouTube 등 공개 영상 URL을 fileData로 함께 전달하면 Gemini가 영상을 직접 시청·분석합니다. */
  const requestParts: Record<string, unknown>[] = opts.fileUri
    ? [{ fileData: { fileUri: opts.fileUri } }, { text: prompt }]
    : [{ text: prompt }]

  const body = JSON.stringify({
    contents: [{ parts: requestParts }],
    generationConfig: buildGeminiGenerationConfig(resolved, opts),
  })

  let lastResult: { ok: false; status: number; error: string } | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_DELAYS_MS[attempt - 1]
      console.warn(`[gemini] retry attempt ${attempt}/${RETRY_DELAYS_MS.length} after ${delayMs}ms (model=${resolved})`)
      await new Promise((r) => setTimeout(r, delayMs))
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      })

      if (!res.ok) {
        const errText = await res.text()
        lastResult = { ok: false, status: res.status, error: errText.slice(0, 300) }
        if (isRetryableStatus(res.status)) continue
        return lastResult
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
        promptFeedback?: { blockReason?: string }
      }
      const parts = data.candidates?.[0]?.content?.parts ?? []
      const text =
        parts
          .filter((p) => !p.thought)
          .map((p) => p.text ?? '')
          .join('') || parts.map((p) => p.text ?? '').join('')

      const finishReason = data.candidates?.[0]?.finishReason
      const truncated = finishReason === 'MAX_TOKENS'
      if (truncated) {
        console.warn(`[gemini] response truncated by MAX_TOKENS (model=${resolved}, textLength=${text.length})`)
      }

      // 프롬프트 자체가 안전 정책에 막히면 candidates가 비고 promptFeedback.blockReason만 채워진다
      const blockReason = !text && !data.candidates?.length ? data.promptFeedback?.blockReason : undefined
      if (blockReason) {
        console.warn(`[gemini] prompt blocked (model=${resolved}, blockReason=${blockReason})`)
      }

      return { ok: true, text, finishReason, truncated, blockReason }
    } catch (err) {
      lastResult = {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : 'Gemini 호출 오류',
      }
      if (isRetryableNetworkError(err)) continue
      return lastResult
    }
  }

  console.error(`[gemini] all retries exhausted (model=${resolved})`)
  return lastResult ?? { ok: false, status: 500, error: 'Gemini 호출 실패' }
}

export function formatGeminiApiError(status: number, rawError: string): string {
  try {
    const parsed = JSON.parse(rawError) as {
      error?: { message?: string }
    }
    const msg = parsed.error?.message?.trim()
    if (msg?.toLowerCase().includes('leaked')) {
      return 'GEMINI_API_KEY가 유출로 차단되었습니다. Google AI Studio에서 새 키를 발급한 뒤 .env.local의 GEMINI_API_KEY를 교체하고 개발 서버를 재시작하세요.'
    }
    if (msg?.includes('API key not valid') || msg?.includes('API_KEY_INVALID')) {
      return 'GEMINI_API_KEY가 올바르지 않습니다. .env.local의 키를 확인하세요.'
    }
    if (
      status === 429 ||
      status === 503 ||
      msg?.toLowerCase().includes('quota') ||
      msg?.toLowerCase().includes('rate') ||
      msg?.toLowerCase().includes('high demand') ||
      msg?.toLowerCase().includes('overloaded')
    ) {
      return 'Gemini 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요. (재시도 2회 후에도 동일 오류)'
    }
    if (msg) return `Gemini API 오류: ${msg}`
  } catch {
    // rawError is not JSON
  }
  return `Gemini API 오류 (${status})`
}

/**
 * Gemini가 "JSON만 응답"하라는 지시에도 가끔 코드펜스·잡담을 섞거나,
 * 멀티라인 문자열 값 안의 줄바꿈·탭을 이스케이프(\n·\t) 없이 그대로 출력해
 * JSON.parse가 실패하는 경우가 있다. 이를 보정해 파싱 가능한 JSON 문자열을 돌려준다.
 * (그래도 실패하면 null — 호출 측에서 원본 텍스트로 한 번 더 시도하거나 포기)
 */
export function sanitizeGeminiJsonText(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const cleaned = fence ? fence[1].trim() : text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let inString = false
  let escaped = false
  let out = ''
  for (const ch of jsonMatch[0]) {
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out += ch
      continue
    }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') { continue }
      if (ch === '\t') { out += '\\t'; continue }
    }
    out += ch
  }

  // 후행 쉼표 제거 (}, ] 앞)
  return out.replace(/,\s*([}\]])/g, '$1')
}

export function extractGeminiTextParts(data: {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
}): string {
  const parts = data.candidates?.[0]?.content?.parts ?? []
  return (
    parts
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('') || parts.map((p) => p.text ?? '').join('')
  )
}
