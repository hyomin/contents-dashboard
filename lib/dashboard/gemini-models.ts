export interface GeminiModelOption {
  id: string
  label: string
  hint: string
}

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: '기본 · 빠름 · 균형' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', hint: '안정 · 경량' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: '고품질 · 느림' },
]

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

export async function callGeminiGenerateContent(
  apiKey: string,
  model: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number; timeoutMs?: number },
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const resolved = resolveGeminiModel(model)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolved}:generateContent?key=${apiKey}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: buildGeminiGenerationConfig(resolved, opts),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { ok: false, status: res.status, error: errText.slice(0, 300) }
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
    }
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text =
      parts
        .filter((p) => !p.thought)
        .map((p) => p.text ?? '')
        .join('') || parts.map((p) => p.text ?? '').join('')

    return { ok: true, text }
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Gemini 호출 오류',
    }
  }
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
