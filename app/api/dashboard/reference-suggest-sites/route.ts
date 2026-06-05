import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { requireGeminiDirectOrRespond } from '@/lib/dashboard/n8n-ai'
import type { GuideCategory } from '@/lib/dashboard/content-creation-guide'
import { callGeminiGenerateContent, resolveGeminiModel } from '@/lib/dashboard/gemini-models'
import {
  buildReferenceSuggestSitesPrompt,
  parseReferenceSuggestSitesResponse,
  type SuggestedReferenceSite,
} from '@/lib/dashboard/reference-suggest-sites'

export type { SuggestedReferenceSite }

interface ReferenceSuggestSitesRequest {
  publishTopic?: string
  category?: GuideCategory
  aiModel?: string
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const geminiBlocked = requireGeminiDirectOrRespond('레퍼런스 사이트 추천')
  if (geminiBlocked) return geminiBlocked

  const apiKey = process.env.GEMINI_API_KEY!.trim()

  const body = (await req.json()) as ReferenceSuggestSitesRequest
  const publishTopic = body.publishTopic?.trim() ?? ''
  if (publishTopic.length < 2) {
    return NextResponse.json({ error: '발행 주제를 2자 이상 입력해 주세요.' }, { status: 400 })
  }

  const model = resolveGeminiModel(body.aiModel)
  const prompt = buildReferenceSuggestSitesPrompt(publishTopic, body.category)

  try {
    const result = await callGeminiGenerateContent(apiKey, model, prompt, {
      temperature: 0.4,
      maxOutputTokens: 2048,
      timeoutMs: 45_000,
    })

    if (!result.ok) {
      console.error('[reference-suggest-sites] gemini error', result.status, result.error)
      return NextResponse.json({ error: `Gemini API 오류 (${result.status})` }, { status: 500 })
    }

    const sites = parseReferenceSuggestSitesResponse(result.text)
    if (sites.length === 0) {
      return NextResponse.json({ error: '추천 사이트를 생성하지 못했습니다. 다시 시도해 주세요.' }, { status: 500 })
    }

    return NextResponse.json({ sites, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[reference-suggest-sites] failed', err)
    return NextResponse.json({ error: '추천 사이트 검색 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
