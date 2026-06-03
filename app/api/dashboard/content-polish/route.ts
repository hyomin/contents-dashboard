import { NextRequest, NextResponse } from 'next/server'
import {
  buildContentPolishPrompt,
  parseContentPolishResponse,
  type ContentPolishRequest,
  type ContentPolishResult,
} from '@/lib/dashboard/content-polish'
import {
  callGeminiGenerateContent,
  formatGeminiApiError,
  resolveGeminiModel,
} from '@/lib/dashboard/gemini-models'

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

  const model = resolveGeminiModel(body.aiModel)
  const prompt = buildContentPolishPrompt(body)

  try {
    const shortform = body.targetFormat === 'shortform' || body.category === 'video'
    const result = await callGeminiGenerateContent(apiKey, model, prompt, {
      temperature: 0.5,
      maxOutputTokens: shortform ? 10_240 : 8192,
      timeoutMs: 90_000,
    })

    if (!result.ok) {
      console.error('[content-polish] gemini error', result.status, result.error)
      const httpStatus = result.status === 403 ? 503 : result.status >= 500 ? 502 : 500
      return NextResponse.json(
        { error: formatGeminiApiError(result.status, result.error) },
        { status: httpStatus },
      )
    }

    const parsed = parseContentPolishResponse(result.text, body.title, { shortform })
    if (!parsed) {
      return NextResponse.json({ error: 'AI 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[content-polish] failed', err)
    return NextResponse.json({ error: '콘텐츠 정재 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
