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

async function suggestWithGemini(params: {
  category: string
  platform: string
  urls: RefUrl[]
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

  const prompt = `당신은 ${platformLabel[params.platform] ?? params.platform} 콘텐츠 전략가입니다.
카테고리: ${params.category || '일반'}
플랫폼: ${platformLabel[params.platform] ?? params.platform}

아래 레퍼런스 콘텐츠들의 vs.Avg(평균 대비 성과) 패턴을 분석해서 새로운 콘텐츠 주제 3개를 제안해주세요.

[레퍼런스 콘텐츠]
${refList}

각 제안마다:
- title: 매력적인 영상 제목 (클릭하고 싶은 제목, 40자 이내)
- hook: 첫 15초 오프닝 훅 전략 (시청자를 붙잡는 방법)
- structure: 콘텐츠 구성 단계 배열 (3~5개)
- keywords: 핵심 키워드 배열 (3~4개)
- estimatedVsAvg: 예상 vs.Avg 범위 (예: "3.5x ~ 5.0x")
- reasoning: 레퍼런스 패턴 기반 선정 이유 (1~2문장)

반드시 JSON만 응답 (다른 텍스트 없이):
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

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(30000),
      },
    )
    if (!res.ok) {
      console.error('[topic-suggest] gemini error', res.status)
      return null
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as { suggestions?: Suggestion[] }
    if (!Array.isArray(parsed.suggestions)) return null
    return {
      category: params.category,
      platform: params.platform,
      suggestions: parsed.suggestions.slice(0, 3),
    }
  } catch (err) {
    console.error('[topic-suggest] gemini failed', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    categoryId?: string
    category?: string
    platform?: string
    urls?: RefUrl[]
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
      return NextResponse.json({ ...result.body, mode: 'n8n' })
    } catch (err) {
      console.error('[topic-suggest] n8n error, falling back to Gemini:', err)
    }
  }

  // 2순위: Gemini 직접 호출
  const geminiResult = await suggestWithGemini({
    category: body.category ?? body.categoryId ?? '일반',
    platform: body.platform ?? 'youtube',
    urls: body.urls ?? [],
  })

  if (geminiResult) {
    return NextResponse.json({ ...geminiResult, mode: 'gemini' })
  }

  return NextResponse.json(
    { error: 'AI 분석을 사용할 수 없습니다. GEMINI_API_KEY 또는 N8N_WEBHOOK_URL을 확인해주세요.', mode: 'error' },
    { status: 503 },
  )
}
