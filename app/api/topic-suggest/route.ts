import { NextRequest, NextResponse } from 'next/server'
import { invokeN8nWebhook } from '@/lib/n8n/invoke-webhook'

interface RefUrl {
  id: string
  url: string
  title: string
  vsAvg: string
}

interface Suggestion {
  title: string
  hook: string
  structure: string[]
  keywords: string[]
  estimatedVsAvg: string
  reasoning: string
}

interface GeminiSuggestResponse {
  category: string
  platform: string
  suggestions: Suggestion[]
}

/**
 * JSON 파싱 헬퍼:
 * - 마크다운 코드블록(```json ... ```) 제거
 * - trailing comma 수정
 * - 최외곽 { } 추출
 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null
  try {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    const cleaned = fenceMatch ? fenceMatch[1].trim() : text

    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!objMatch) return null

    const fixed = objMatch[0].replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixed) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Gemini API 호출 (Thinking 모델 대응)
 *
 * Gemini 2.5 Flash: parts 배열에 { thought: true } 파츠가 먼저 오고
 * 실제 응답이 뒤에 온다. parts[0].text를 그대로 쓰면 내부 추론 텍스트를
 * JSON으로 파싱하게 되어 항상 실패한다.
 */
async function callGeminiWithFallback(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const models = ['gemini-2.5-flash', 'gemini-2.5-pro']

  for (const model of models) {
    try {
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 4096,
          // Thinking 모드 비활성화 → 빠르고 예측 가능한 JSON 출력
          ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(40000),
        },
      )

      if (!res.ok) {
        console.warn(`[topic-suggest] ${model} HTTP ${res.status}`)
        continue
      }

      const data = (await res.json()) as {
        candidates?: {
          content?: { parts?: { text?: string; thought?: boolean }[] }
        }[]
      }

      const parts = data.candidates?.[0]?.content?.parts ?? []

      // Thinking 모델: thought:true 파츠를 제외한 실제 응답만 수집
      const nonThought = parts.filter((p) => !p.thought)
      const text =
        nonThought.map((p) => p.text ?? '').join('') ||
        parts.map((p) => p.text ?? '').join('')

      if (text) return text
      console.warn(`[topic-suggest] ${model} returned empty text`)
    } catch (err) {
      console.warn(`[topic-suggest] ${model} error:`, err instanceof Error ? err.message : err)
    }
  }

  return ''
}

async function suggestWithGemini(params: {
  category: string
  platform: string
  urls: RefUrl[]
  trendingKeywords?: string[]
}): Promise<GeminiSuggestResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null

  const platformLabel: Record<string, string> = {
    youtube: 'YouTube',
    instagram: 'Instagram',
    'naver-blog': '네이버 블로그',
    tistory: '티스토리',
  }

  const refList = params.urls
    .slice(0, 10)
    .map((u, i) => `${i + 1}. 제목: "${u.title}" | vs.Avg: ${u.vsAvg}x | URL: ${u.url}`)
    .join('\n')

  const trendingSection =
    params.trendingKeywords && params.trendingKeywords.length > 0
      ? `\n[현재 트렌딩 키워드]\n${params.trendingKeywords.slice(0, 8).join(', ')}\n`
      : ''

  const prompt = `당신은 ${platformLabel[params.platform] ?? params.platform} 콘텐츠 전략가입니다.
카테고리: ${params.category || '일반'}
플랫폼: ${platformLabel[params.platform] ?? params.platform}

아래 레퍼런스 콘텐츠들의 vs.Avg(평균 대비 성과) 패턴을 분석해서 새로운 콘텐츠 주제 3개를 제안해주세요.
${trendingSection}
[레퍼런스 콘텐츠]
${refList || '(레퍼런스 없음 - 카테고리와 플랫폼 기반으로 최적 주제 제안)'}

각 제안마다:
- title: 매력적인 제목 (클릭하고 싶게, 40자 이내)
- hook: 첫 15초 오프닝 훅 전략 (시청자를 붙잡는 구체적인 방법)
- structure: 콘텐츠 구성 단계 배열 (3~5개 항목)
- keywords: 핵심 키워드 배열 (3~4개)
- estimatedVsAvg: 예상 vs.Avg 범위 (예: "3.5x ~ 5.0x")
- reasoning: 레퍼런스 패턴 기반 선정 이유 (1~2문장)

반드시 JSON만 응답 (마크다운·설명 텍스트 없이):
{
  "suggestions": [
    {
      "title": "...",
      "hook": "...",
      "structure": ["...", "..."],
      "keywords": ["...", "..."],
      "estimatedVsAvg": "...",
      "reasoning": "..."
    }
  ]
}`

  const text = await callGeminiWithFallback(prompt, apiKey)
  if (!text) return null

  const parsed = parseJsonObject(text)
  if (!parsed) return null

  const suggestions = parsed.suggestions
  if (!Array.isArray(suggestions)) return null

  return {
    category: params.category,
    platform: params.platform,
    suggestions: (suggestions as Suggestion[]).slice(0, 3),
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    categoryId?: string
    category?: string
    platform?: string
    urls?: RefUrl[]
    trendingKeywords?: string[]
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL

  // 1순위: n8n 웹훅
  if (webhookUrl) {
    try {
      const result = await invokeN8nWebhook(webhookUrl, {
        categoryId: body.categoryId,
        category: body.category,
        platform: body.platform,
        urls: body.urls,
        promptVersion: '1.0',
        requestedAt: new Date().toISOString(),
      })
      if (!result.ok) throw new Error(`n8n responded with ${result.status}`)
      return NextResponse.json({ ...(result.body as Record<string, unknown>), mode: 'n8n' })
    } catch (err) {
      console.error('[topic-suggest] n8n error, falling back to Gemini:', err)
    }
  }

  // 2순위: Gemini 직접 호출
  const geminiResult = await suggestWithGemini({
    category: body.category ?? body.categoryId ?? '일반',
    platform: body.platform ?? 'youtube',
    urls: body.urls ?? [],
    trendingKeywords: body.trendingKeywords,
  })

  if (geminiResult) {
    return NextResponse.json({ ...geminiResult, mode: 'gemini' })
  }

  return NextResponse.json(
    {
      error:
        'AI 분석을 사용할 수 없습니다. GEMINI_API_KEY 또는 N8N_WEBHOOK_URL을 확인해주세요.',
      mode: 'error',
    },
    { status: 503 },
  )
}
