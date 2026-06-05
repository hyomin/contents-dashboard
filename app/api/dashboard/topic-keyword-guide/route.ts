import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { requireGeminiDirectOrRespond } from '@/lib/dashboard/n8n-ai'
import {
  buildTopicKeywordGuidePrompt,
  parseTopicKeywordGuideResponse,
  type TopicKeywordGuideResult,
} from '@/lib/dashboard/topic-keyword-guide'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import {
  callGeminiGenerateContent,
  formatGeminiApiError,
  resolveGeminiModel,
} from '@/lib/dashboard/gemini-models'

export type { TopicKeywordGuideResult }

interface TopicKeywordGuideRequest {
  seedKeyword?: string
  category?: GuideCategory
  shortformCategoryId?: string
  aiModel?: string
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const geminiBlocked = requireGeminiDirectOrRespond('주제 가이드')
  if (geminiBlocked) return geminiBlocked

  const apiKey = process.env.GEMINI_API_KEY!.trim()

  const body = (await req.json()) as TopicKeywordGuideRequest
  const seedKeyword = body.seedKeyword?.trim() ?? ''
  if (seedKeyword.length < 2) {
    return NextResponse.json({ error: '주제 가이드 키워드를 2자 이상 입력해 주세요.' }, { status: 400 })
  }

  const model = resolveGeminiModel(body.aiModel)
  const prompt = buildTopicKeywordGuidePrompt(
    seedKeyword,
    body.category,
    body.shortformCategoryId,
  )

  try {
    const result = await callGeminiGenerateContent(apiKey, model, prompt, {
      temperature: 0.7,
      maxOutputTokens: 4096,
      timeoutMs: 60_000,
    })

    if (!result.ok) {
      console.error('[topic-keyword-guide] gemini error', result.status, result.error)
      const httpStatus = result.status === 403 ? 503 : result.status >= 500 ? 502 : 500
      return NextResponse.json(
        { error: formatGeminiApiError(result.status, result.error) },
        { status: httpStatus },
      )
    }

    const parsed = parseTopicKeywordGuideResponse(result.text, seedKeyword)
    if (!parsed) {
      return NextResponse.json({ error: 'AI 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[topic-keyword-guide] failed', err)
    return NextResponse.json({ error: '주제 가이드 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
