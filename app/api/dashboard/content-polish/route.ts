import { NextRequest, NextResponse } from 'next/server'
import {
  buildContentPolishPrompt,
  parseContentPolishResponse,
  type ContentPolishRequest,
  type ContentPolishResult,
} from '@/lib/dashboard/content-polish'

export type { ContentPolishRequest, ContentPolishResult }

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 503 })
  }

  const body = (await req.json()) as ContentPolishRequest
  if (!body.fullScript?.trim()) {
    return NextResponse.json({ error: 'fullScript가 필요합니다.' }, { status: 400 })
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title이 필요합니다.' }, { status: 400 })
  }

  const prompt = buildContentPolishPrompt(body)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[content-polish] gemini error', res.status, errText.slice(0, 300))
      return NextResponse.json({ error: `Gemini API 오류 (${res.status})` }, { status: 500 })
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

    const result = parseContentPolishResponse(text, body.title)
    if (!result) {
      return NextResponse.json({ error: 'AI 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[content-polish] failed', err)
    return NextResponse.json({ error: '콘텐츠 정재 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
