import { NextRequest, NextResponse } from 'next/server'
import { denyUnlessDashboardMutationAuth } from '@/lib/dashboard/api-auth'
import { requireGeminiDirectOrRespond } from '@/lib/dashboard/n8n-ai'
import {
  buildContentAnalyzerPrompt,
  detectContentPlatform,
  normalizeYoutubeUrlForGemini,
  parseContentAnalyzerResponse,
  supportsDirectVideoAnalysis,
  type ContentAnalyzerResult,
} from '@/lib/dashboard/content-analyzer'
import {
  callGeminiGenerateContent,
  formatGeminiApiError,
  resolveGeminiModel,
} from '@/lib/dashboard/gemini-models'

export type { ContentAnalyzerResult }

interface ContentAnalyzerRequest {
  url?: string
  notes?: string
  aiModel?: string
}

function isLikelyUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessDashboardMutationAuth(req)
  if (denied) return denied

  const geminiBlocked = requireGeminiDirectOrRespond('콘텐츠 분석기')
  if (geminiBlocked) return geminiBlocked

  const apiKey = process.env.GEMINI_API_KEY!.trim()

  const body = (await req.json()) as ContentAnalyzerRequest
  const url = body.url?.trim() ?? ''
  if (!isLikelyUrl(url)) {
    return NextResponse.json({ error: '분석할 콘텐츠의 URL을 정확히 입력해 주세요. (https://...)' }, { status: 400 })
  }

  const platform = detectContentPlatform(url)
  const canWatchDirectly = supportsDirectVideoAnalysis(platform)
  const model = resolveGeminiModel(body.aiModel)
  const prompt = buildContentAnalyzerPrompt(url, platform, canWatchDirectly, body.notes)

  try {
    const result = await callGeminiGenerateContent(apiKey, model, prompt, {
      temperature: 0.6,
      maxOutputTokens: 6144,
      timeoutMs: 90_000,
      fileUri: canWatchDirectly ? normalizeYoutubeUrlForGemini(url) : undefined,
    })

    if (!result.ok) {
      console.error('[content-analyzer] gemini error', result.status, result.error)
      const httpStatus = result.status === 403 ? 503 : result.status >= 500 ? 502 : 500
      return NextResponse.json(
        { error: formatGeminiApiError(result.status, result.error) },
        { status: httpStatus },
      )
    }

    const parsed = parseContentAnalyzerResponse(result.text, url, platform)
    if (!parsed) {
      return NextResponse.json({ error: 'AI 분석 응답 파싱에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 })
    }

    return NextResponse.json({ result: parsed, canWatchDirectly })
  } catch (err) {
    console.error('[content-analyzer] failed', err)
    return NextResponse.json({ error: '콘텐츠 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
